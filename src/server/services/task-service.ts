import { z } from "zod";
import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/http";
import { writeAuditLog } from "@/server/audit";
import { recordTimeline } from "@/server/timeline";
import { notifyUsers } from "@/server/services/notification-service";
import { isAssignedOnlyRole, loadScopedProject } from "@/server/tenancy/access";
import type { Prisma, TaskPriority, TaskStatus } from "@prisma/client";

const optionalDate = z.string().optional().nullable();

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(8000).optional().nullable(),
  projectId: z.string().min(1).optional().nullable(),
  taskListId: z.string().min(1).optional().nullable(),
  taskListName: z.string().trim().max(120).optional().nullable(),
  parentTaskId: z.string().min(1).optional().nullable(),
  assigneeId: z.string().min(1).optional().nullable(),
  dueAt: optionalDate,
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  items: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(8000).optional().nullable(),
  assigneeId: z.string().min(1).optional().nullable(),
  dueAt: optionalDate,
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
  taskListId: z.string().min(1).optional().nullable(),
});

function parseDue(value?: string | null) {
  if (value == null || value.trim() === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(400, "Invalid due date.");
  return date;
}

function actorName(ctx: AuthContext) {
  return `${ctx.user.firstName} ${ctx.user.lastName}`.trim();
}

export function taskVisibilityWhere(ctx: AuthContext): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {
    companyId: ctx.company.id,
    deletedAt: null,
  };
  if (isAssignedOnlyRole(ctx)) {
    where.OR = [
      { assigneeId: ctx.user.id },
      { project: { members: { some: { userId: ctx.user.id } } } },
    ];
  }
  return where;
}

const taskInclude = {
  assignee: { select: { id: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  project: { select: { id: true, name: true, number: true } },
  taskList: { select: { id: true, name: true } },
  items: { orderBy: { sortOrder: "asc" as const } },
  children: {
    where: { deletedAt: null },
    select: { id: true, title: true, status: true, assigneeId: true },
  },
  _count: { select: { media: true, children: true } },
} satisfies Prisma.TaskInclude;

async function assertAssignee(companyId: string, userId?: string | null) {
  if (!userId) return;
  const member = await prisma.companyMembership.findFirst({
    where: { companyId, userId, status: "active", deletedAt: null },
  });
  if (!member) throw new AppError(400, "Assignee is not in this company.");
}

export async function loadVisibleTask(ctx: AuthContext, id: string) {
  requirePermission(ctx, "tasks.view");
  const task = await prisma.task.findFirst({
    where: { id, ...taskVisibilityWhere(ctx) },
    include: taskInclude,
  });
  if (!task) throw new AppError(404, "Not found.");
  return task;
}

export async function listTasks(
  ctx: AuthContext,
  filters: {
    projectId?: string;
    status?: TaskStatus;
    assigneeId?: string;
    q?: string;
    mine?: boolean;
  } = {},
) {
  requirePermission(ctx, "tasks.view");
  if (filters.projectId) await loadScopedProject(ctx, filters.projectId);
  const where: Prisma.TaskWhereInput = {
    ...taskVisibilityWhere(ctx),
    parentTaskId: null,
  };
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = filters.status;
  if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  if (filters.mine) where.assigneeId = ctx.user.id;
  if (filters.q) {
    const visibilityOr = where.OR;
    delete where.OR;
    where.AND = [
      ...(visibilityOr ? [{ OR: visibilityOr }] : []),
      { OR: [{ title: { contains: filters.q } }, { description: { contains: filters.q } }] },
    ];
  }
  return prisma.task.findMany({
    where,
    include: taskInclude,
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function listTaskLists(ctx: AuthContext, projectId: string) {
  requirePermission(ctx, "tasks.view");
  await loadScopedProject(ctx, projectId);
  return prisma.taskList.findMany({
    where: { companyId: ctx.company.id, projectId, deletedAt: null },
    include: {
      tasks: {
        where: { deletedAt: null },
        include: taskInclude,
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createTaskList(ctx: AuthContext, projectId: string, name: string) {
  requirePermission(ctx, "tasks.create");
  await loadScopedProject(ctx, projectId);
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, "List name is required.");
  return prisma.taskList.create({
    data: { companyId: ctx.company.id, projectId, name: trimmed },
  });
}

export async function createTask(ctx: AuthContext, input: unknown, meta: { ip?: string | null } = {}) {
  requirePermission(ctx, "tasks.create");
  const data = createSchema.parse(input);
  if (data.projectId) await loadScopedProject(ctx, data.projectId);
  await assertAssignee(ctx.company.id, data.assigneeId);
  if (data.parentTaskId) {
    const parent = await loadVisibleTask(ctx, data.parentTaskId);
    if (data.projectId && parent.projectId && parent.projectId !== data.projectId) {
      throw new AppError(400, "Subtask must stay on the same job.");
    }
  }
  let taskListId = data.taskListId ?? null;
  if (data.taskListName?.trim()) {
    if (!data.projectId) throw new AppError(400, "A job is required to create a task list.");
    const list = await prisma.taskList.create({
      data: { companyId: ctx.company.id, projectId: data.projectId, name: data.taskListName.trim() },
    });
    taskListId = list.id;
  } else if (taskListId) {
    const list = await prisma.taskList.findFirst({
      where: { id: taskListId, companyId: ctx.company.id, deletedAt: null },
    });
    if (!list) throw new AppError(400, "Task list not found.");
  }

  const task = await prisma.task.create({
    data: {
      companyId: ctx.company.id,
      projectId: data.projectId ?? null,
      taskListId,
      parentTaskId: data.parentTaskId ?? null,
      title: data.title,
      description: data.description?.trim() ?? "",
      priority: (data.priority ?? "normal") as TaskPriority,
      dueAt: parseDue(data.dueAt),
      assigneeId: data.assigneeId ?? null,
      createdById: ctx.user.id,
      items: data.items?.length
        ? {
            create: data.items.map((title, index) => ({
              companyId: ctx.company.id,
              title,
              sortOrder: index,
            })),
          }
        : undefined,
    },
    include: taskInclude,
  });

  await writeAuditLog({
    companyId: ctx.company.id,
    userId: ctx.user.id,
    action: "task.created",
    entityType: "task",
    entityId: task.id,
    ipAddress: meta.ip,
  });
  await recordTimeline({
    companyId: ctx.company.id,
    projectId: task.projectId,
    actorUserId: ctx.user.id,
    type: "task.created",
    description: `${actorName(ctx)} created task “${task.title}”`,
    entityType: "task",
    entityId: task.id,
  });
  if (task.assigneeId) {
    await notifyUsers({
      companyId: ctx.company.id,
      userIds: [task.assigneeId],
      actorUserId: ctx.user.id,
      type: "task.assigned",
      title: `Assigned: ${task.title}`,
      body: "Open Tasks to complete it.",
      entityType: "task",
      entityId: task.id,
      projectId: task.projectId,
    });
  }
  return task;
}

export async function updateTask(ctx: AuthContext, id: string, input: unknown) {
  requirePermission(ctx, "tasks.edit");
  const existing = await loadVisibleTask(ctx, id);
  const data = updateSchema.parse(input);
  if (data.assigneeId !== undefined) await assertAssignee(ctx.company.id, data.assigneeId);
  const nextStatus = data.status as TaskStatus | undefined;
  const task = await prisma.task.update({
    where: { id: existing.id },
    data: {
      title: data.title ?? existing.title,
      description: data.description === undefined ? undefined : (data.description ?? ""),
      assigneeId: data.assigneeId === undefined ? undefined : data.assigneeId,
      dueAt: data.dueAt === undefined ? undefined : parseDue(data.dueAt),
      priority: data.priority,
      status: nextStatus,
      completedAt: nextStatus === "completed" ? new Date() : nextStatus ? null : undefined,
      taskListId: data.taskListId === undefined ? undefined : data.taskListId,
    },
    include: taskInclude,
  });
  if (nextStatus === "completed" && existing.status !== "completed") {
    await recordTimeline({
      companyId: ctx.company.id,
      projectId: task.projectId,
      actorUserId: ctx.user.id,
      type: "task.completed",
      description: `${actorName(ctx)} completed “${task.title}”`,
      entityType: "task",
      entityId: task.id,
    });
  } else {
    await recordTimeline({
      companyId: ctx.company.id,
      projectId: task.projectId,
      actorUserId: ctx.user.id,
      type: "task.updated",
      description: `${actorName(ctx)} updated task “${task.title}”`,
      entityType: "task",
      entityId: task.id,
    });
  }
  if (data.assigneeId && data.assigneeId !== existing.assigneeId) {
    await notifyUsers({
      companyId: ctx.company.id,
      userIds: [data.assigneeId],
      actorUserId: ctx.user.id,
      type: "task.assigned",
      title: `Assigned: ${task.title}`,
      body: "Open Tasks to complete it.",
      entityType: "task",
      entityId: task.id,
      projectId: task.projectId,
    });
  }
  return task;
}

export async function completeTask(ctx: AuthContext, id: string) {
  requirePermission(ctx, "tasks.complete");
  const existing = await loadVisibleTask(ctx, id);
  if (existing.status === "completed") return existing;
  const task = await prisma.task.update({
    where: { id: existing.id },
    data: { status: "completed", completedAt: new Date() },
    include: taskInclude,
  });
  await recordTimeline({
    companyId: ctx.company.id,
    projectId: task.projectId,
    actorUserId: ctx.user.id,
    type: "task.completed",
    description: `${actorName(ctx)} completed “${task.title}”`,
    entityType: "task",
    entityId: task.id,
  });
  return task;
}

export async function deleteTask(ctx: AuthContext, id: string) {
  requirePermission(ctx, "tasks.edit");
  const existing = await loadVisibleTask(ctx, id);
  await prisma.task.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}

export async function addTaskItem(ctx: AuthContext, taskId: string, title: string) {
  requirePermission(ctx, "tasks.edit");
  const trimmed = title.trim();
  if (!trimmed) throw new AppError(400, "Item title is required.");
  const task = await loadVisibleTask(ctx, taskId);
  const count = await prisma.taskItem.count({ where: { taskId: task.id } });
  return prisma.taskItem.create({
    data: {
      companyId: ctx.company.id,
      taskId: task.id,
      title: title.trim(),
      sortOrder: count,
    },
  });
}

export async function setTaskItemComplete(ctx: AuthContext, itemId: string, isComplete: boolean) {
  requirePermission(ctx, "tasks.complete");
  const item = await prisma.taskItem.findFirst({
    where: { id: itemId, companyId: ctx.company.id },
    include: { task: true },
  });
  if (!item || item.task.deletedAt) throw new AppError(404, "Not found.");
  await loadVisibleTask(ctx, item.taskId);
  return prisma.taskItem.update({
    where: { id: item.id },
    data: { isComplete },
  });
}

export async function addTaskComment(ctx: AuthContext, taskId: string, body: string) {
  requirePermission(ctx, "tasks.view");
  const task = await loadVisibleTask(ctx, taskId);
  const text = body.trim();
  if (!text) throw new AppError(400, "Comment is required.");
  const comment = await prisma.comment.create({
    data: {
      companyId: ctx.company.id,
      projectId: task.projectId,
      authorId: ctx.user.id,
      body: text,
      parentType: "task",
      parentId: task.id,
    },
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  await recordTimeline({
    companyId: ctx.company.id,
    projectId: task.projectId,
    actorUserId: ctx.user.id,
    type: "comment.added",
    description: `${actorName(ctx)} commented on “${task.title}”`,
    entityType: "task",
    entityId: task.id,
  });
  if (task.assigneeId) {
    await notifyUsers({
      companyId: ctx.company.id,
      userIds: [task.assigneeId],
      actorUserId: ctx.user.id,
      type: "project.message",
      title: `${actorName(ctx)} commented on “${task.title}”`,
      body: text.slice(0, 280),
      entityType: "task",
      entityId: task.id,
      projectId: task.projectId,
    });
  }
  return comment;
}

export async function listTaskComments(ctx: AuthContext, taskId: string) {
  const task = await loadVisibleTask(ctx, taskId);
  return prisma.comment.findMany({
    where: { companyId: ctx.company.id, parentType: "task", parentId: task.id, deletedAt: null },
    include: { author: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
}

export async function listOutstandingTasks(ctx: AuthContext, take = 8) {
  requirePermission(ctx, "tasks.view");
  return prisma.task.findMany({
    where: {
      ...taskVisibilityWhere(ctx),
      status: { in: ["open", "in_progress"] },
    },
    include: {
      project: { select: { id: true, name: true, number: true } },
      assignee: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take,
  });
}
