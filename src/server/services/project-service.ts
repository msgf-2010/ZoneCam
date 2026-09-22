import { z } from "zod";
import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/http";
import { writeAuditLog } from "@/server/audit";
import { recordTimeline } from "@/server/timeline";
import { notifyUsers, projectAudienceUserIds } from "@/server/services/notification-service";
import { canEditProject, canStartAssignedJob, loadScopedProject, projectScopeWhere } from "@/server/tenancy/access";
import { signedMediaPath } from "@/server/adapters/storage";

const optionalText = z.string().trim().max(200).optional().nullable();

const projectSchema = z.object({
  name: z.string().trim().min(1).max(160),
  number: z.string().trim().max(40).optional().nullable(),
  customerId: z.string().min(1).optional().nullable(),
  customerContactId: z.string().min(1).optional().nullable(),
  projectTypeId: z.string().min(1).optional().nullable(),
  projectStatusKey: z.string().trim().min(1).optional(),
  description: z.string().trim().max(8000).optional().nullable(),
  internalNotes: z.string().trim().max(8000).optional().nullable(),
  customerNotes: z.string().trim().max(8000).optional().nullable(),
  addressLine1: optionalText,
  addressLine2: optionalText,
  city: optionalText,
  region: optionalText,
  postalCode: z.string().trim().max(20).optional().nullable(),
  country: optionalText,
  latitude: z.number().gte(-90).lte(90).optional().nullable(),
  longitude: z.number().gte(-180).lte(180).optional().nullable(),
  startDate: z.string().optional().nullable(),
  expectedCompletionDate: z.string().optional().nullable(),
  memberIds: z.array(z.string().min(1)).optional(),
});

function emptyToNull(value?: string | null) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseDate(value?: string | null) {
  if (value == null || value.trim() === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(400, "Invalid date.");
  return date;
}

async function nextProjectNumber(companyId: string) {
  const count = await prisma.project.count({ where: { companyId } });
  let n = count + 1;
  for (let i = 0; i < 20; i += 1) {
    const number = `JOB-${String(n).padStart(4, "0")}`;
    const exists = await prisma.project.findUnique({
      where: { companyId_number: { companyId, number } },
    });
    if (!exists) return number;
    n += 1;
  }
  return `JOB-${Date.now()}`;
}

async function statusByKey(companyId: string, key: string) {
  const status = await prisma.projectStatus.findUnique({
    where: { companyId_key: { companyId, key } },
  });
  if (!status) throw new AppError(400, "Unknown project status.");
  return status;
}

async function assertCustomerInCompany(companyId: string, customerId?: string | null) {
  if (!customerId) return;
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId, deletedAt: null },
  });
  if (!customer) throw new AppError(400, "Customer not found in this company.");
}

async function assertContactInCustomer(companyId: string, customerId: string | null | undefined, contactId?: string | null) {
  if (!contactId) return;
  const contact = await prisma.customerContact.findFirst({
    where: { id: contactId, companyId, deletedAt: null, ...(customerId ? { customerId } : {}) },
  });
  if (!contact) throw new AppError(400, "Contact not found for this customer.");
}

async function assertTypeInCompany(companyId: string, typeId?: string | null) {
  if (!typeId) return;
  const type = await prisma.projectType.findFirst({ where: { id: typeId, companyId } });
  if (!type) throw new AppError(400, "Unknown project type.");
}

async function assertMembersInCompany(companyId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const count = await prisma.companyMembership.count({
    where: { companyId, userId: { in: userIds }, status: "active", deletedAt: null },
  });
  if (count !== userIds.length) throw new AppError(400, "One or more assignees are not in this company.");
}

const projectInclude = Prisma.validator<Prisma.ProjectInclude>()({
  customer: true,
  customerContact: true,
  projectType: true,
  projectStatus: true,
  members: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
  locations: { orderBy: { isPrimary: "desc" } },
  media: {
    where: { deletedAt: null, type: "photo" },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { id: true, originalFilename: true, type: true },
  },
});

export type ProjectListItem = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

export async function listProjectMeta(ctx: AuthContext) {
  requirePermission(ctx, "projects.view");
  const [statuses, types, members] = await Promise.all([
    prisma.projectStatus.findMany({
      where: { companyId: ctx.company.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.projectType.findMany({
      where: { companyId: ctx.company.id },
      orderBy: { name: "asc" },
    }),
    prisma.companyMembership.findMany({
      where: { companyId: ctx.company.id, status: "active", deletedAt: null },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return {
    statuses,
    types,
    members: members.map((m) => m.user),
  };
}

export async function listProjects(
  ctx: AuthContext,
  filters: { q?: string; statusKey?: string; today?: boolean } = {},
) {
  requirePermission(ctx, "projects.view");
  const where = projectScopeWhere(ctx);
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q } },
      { number: { contains: filters.q } },
      { city: { contains: filters.q } },
    ];
  }
  if (filters.statusKey) {
    where.projectStatus = { key: filters.statusKey };
  }
  if (filters.today) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.startDate = { gte: start, lt: end };
  }
  return prisma.project.findMany({
    where,
    include: projectInclude,
    orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
    take: 50,
  }) satisfies Promise<ProjectListItem[]>;
}

export async function listFieldJobs(ctx: AuthContext) {
  requirePermission(ctx, "projects.view");
  const jobs = await prisma.project.findMany({
    where: projectScopeWhere(ctx),
    include: {
      customer: { select: { name: true } },
      projectStatus: true,
      media: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, originalFilename: true },
      },
      comments: {
        where: { deletedAt: null, parentType: "project" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, author: { select: { firstName: true } } },
      },
      _count: { select: { media: { where: { deletedAt: null } } } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
  });
  return jobs.map((job) => ({
    ...job,
    photoCount: job._count.media,
    thumbs: job.media.map((item) => ({
      id: item.id,
      name: item.originalFilename,
      url: signedMediaPath(item.id, "thumbnail"),
    })),
    lastMessage: job.comments[0]
      ? `${job.comments[0].author?.firstName ?? "Office"}: ${job.comments[0].body}`
      : null,
  }));
}

export async function getProject(ctx: AuthContext, id: string) {
  requirePermission(ctx, "projects.view");
  const project = await prisma.project.findFirst({
    where: { id, ...projectScopeWhere(ctx) },
    include: {
      ...projectInclude,
      notes: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { author: { select: { firstName: true, lastName: true } } },
      },
      timelineEvents: {
        orderBy: { createdAt: "desc" },
        take: 40,
        include: { actor: { select: { firstName: true, lastName: true } } },
      },
      tasks: {
        where: { deletedAt: null, parentTaskId: null },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          assignee: { select: { firstName: true, lastName: true } },
          items: { orderBy: { sortOrder: "asc" } },
        },
      },
      checklists: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 16,
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
      media: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, originalFilename: true, type: true, createdAt: true, thumbnailKey: true },
      },
      _count: { select: { media: true, tasks: true, notes: true, comments: true, checklists: true } },
    },
  });
  if (!project) throw new AppError(404, "Not found.");
  return project;
}

export async function createProject(ctx: AuthContext, input: unknown, meta: { ip?: string | null }) {
  requirePermission(ctx, "projects.create");
  const data = projectSchema.parse(input);
  await assertCustomerInCompany(ctx.company.id, data.customerId);
  await assertContactInCustomer(ctx.company.id, data.customerId, data.customerContactId);
  await assertTypeInCompany(ctx.company.id, data.projectTypeId);
  const memberIds = data.memberIds ?? [];
  await assertMembersInCompany(ctx.company.id, memberIds);
  const status = await statusByKey(ctx.company.id, data.projectStatusKey ?? "new");
  const number = emptyToNull(data.number) ?? (await nextProjectNumber(ctx.company.id));

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        companyId: ctx.company.id,
        name: data.name,
        number,
        customerId: emptyToNull(data.customerId),
        customerContactId: emptyToNull(data.customerContactId),
        projectTypeId: emptyToNull(data.projectTypeId),
        projectStatusId: status.id,
        description: data.description?.trim() ?? "",
        internalNotes: data.internalNotes?.trim() ?? "",
        customerNotes: data.customerNotes?.trim() ?? "",
        addressLine1: emptyToNull(data.addressLine1),
        addressLine2: emptyToNull(data.addressLine2),
        city: emptyToNull(data.city),
        region: emptyToNull(data.region),
        postalCode: emptyToNull(data.postalCode),
        country: emptyToNull(data.country),
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        startDate: parseDate(data.startDate),
        expectedCompletionDate: parseDate(data.expectedCompletionDate),
        createdById: ctx.user.id,
      },
    });
    await tx.projectLocation.create({
      data: {
        companyId: ctx.company.id,
        projectId: created.id,
        label: "Primary",
        addressLine1: emptyToNull(data.addressLine1),
        city: emptyToNull(data.city),
        region: emptyToNull(data.region),
        postalCode: emptyToNull(data.postalCode),
        country: emptyToNull(data.country),
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        isPrimary: true,
      },
    });
    if (memberIds.length) {
      await tx.projectMember.createMany({
        data: memberIds.map((userId) => ({
          companyId: ctx.company.id,
          projectId: created.id,
          userId,
        })),
      });
    }
    return created;
  });

  await recordTimeline({
    companyId: ctx.company.id,
    projectId: project.id,
    actorUserId: ctx.user.id,
    type: "project.created",
    description: `Project ${number} created`,
    entityType: "project",
    entityId: project.id,
  });
  for (const userId of memberIds) {
    await recordTimeline({
      companyId: ctx.company.id,
      projectId: project.id,
      actorUserId: ctx.user.id,
      type: "project.member.assigned",
      description: "Team member assigned",
      entityType: "user",
      entityId: userId,
    });
  }
  await writeAuditLog({
    action: "project.create",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "project",
    entityId: project.id,
    ipAddress: meta.ip,
    metadata: { number },
  });
  return getProject(ctx, project.id);
}

export async function updateProject(ctx: AuthContext, id: string, input: unknown, meta: { ip?: string | null }) {
  requirePermission(ctx, "projects.edit");
  await loadScopedProject(ctx, id);
  const data = projectSchema.partial().parse(input);
  if (data.customerId !== undefined) await assertCustomerInCompany(ctx.company.id, data.customerId);
  if (data.customerContactId !== undefined) {
    await assertContactInCustomer(ctx.company.id, data.customerId, data.customerContactId);
  }
  if (data.projectTypeId !== undefined) await assertTypeInCompany(ctx.company.id, data.projectTypeId);

  let projectStatusId: string | undefined;
  if (data.projectStatusKey) {
    projectStatusId = (await statusByKey(ctx.company.id, data.projectStatusKey)).id;
  }

  const previous = await prisma.project.findFirstOrThrow({
    where: { id, companyId: ctx.company.id },
    include: { projectStatus: true },
  });
  await prisma.project.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.number ? { number: data.number } : {}),
      customerId: data.customerId !== undefined ? emptyToNull(data.customerId) : undefined,
      customerContactId: data.customerContactId !== undefined ? emptyToNull(data.customerContactId) : undefined,
      projectTypeId: data.projectTypeId !== undefined ? emptyToNull(data.projectTypeId) : undefined,
      projectStatusId,
      description: data.description !== undefined ? (data.description?.trim() ?? "") : undefined,
      internalNotes: data.internalNotes !== undefined ? (data.internalNotes?.trim() ?? "") : undefined,
      customerNotes: data.customerNotes !== undefined ? (data.customerNotes?.trim() ?? "") : undefined,
      addressLine1: data.addressLine1 !== undefined ? emptyToNull(data.addressLine1) : undefined,
      addressLine2: data.addressLine2 !== undefined ? emptyToNull(data.addressLine2) : undefined,
      city: data.city !== undefined ? emptyToNull(data.city) : undefined,
      region: data.region !== undefined ? emptyToNull(data.region) : undefined,
      postalCode: data.postalCode !== undefined ? emptyToNull(data.postalCode) : undefined,
      country: data.country !== undefined ? emptyToNull(data.country) : undefined,
      latitude: data.latitude !== undefined ? data.latitude : undefined,
      longitude: data.longitude !== undefined ? data.longitude : undefined,
      startDate: data.startDate !== undefined ? parseDate(data.startDate) : undefined,
      expectedCompletionDate:
        data.expectedCompletionDate !== undefined ? parseDate(data.expectedCompletionDate) : undefined,
      completedAt:
        data.projectStatusKey === "completed"
          ? new Date()
          : data.projectStatusKey && data.projectStatusKey !== "completed"
            ? null
            : undefined,
    },
  });

  if (data.projectStatusKey && data.projectStatusKey !== previous.projectStatus.key) {
    await recordTimeline({
      companyId: ctx.company.id,
      projectId: id,
      actorUserId: ctx.user.id,
      type: "project.status.changed",
      description: `Status set to ${data.projectStatusKey.replaceAll("_", " ")}`,
      entityType: "project",
      entityId: id,
    });
  }
  await writeAuditLog({
    action: "project.update",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "project",
    entityId: id,
    ipAddress: meta.ip,
  });
  return getProject(ctx, id);
}

export async function deleteProject(ctx: AuthContext, id: string, meta: { ip?: string | null }) {
  requirePermission(ctx, "projects.delete");
  await loadScopedProject(ctx, id);
  await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAuditLog({
    action: "project.delete",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "project",
    entityId: id,
    ipAddress: meta.ip,
  });
}

export async function setProjectMembers(ctx: AuthContext, projectId: string, userIds: string[], meta: { ip?: string | null }) {
  requirePermission(ctx, "projects.edit");
  await loadScopedProject(ctx, projectId);
  await assertMembersInCompany(ctx.company.id, userIds);
  const existing = await prisma.projectMember.findMany({ where: { projectId, companyId: ctx.company.id } });
  const existingIds = new Set(existing.map((m) => m.userId));
  const nextIds = new Set(userIds);
  const added = userIds.filter((id) => !existingIds.has(id));
  const removed = existing.filter((m) => !nextIds.has(m.userId));

  await prisma.$transaction(async (tx) => {
    if (userIds.length === 0) {
      await tx.projectMember.deleteMany({ where: { projectId, companyId: ctx.company.id } });
      return;
    }
    await tx.projectMember.deleteMany({
      where: { projectId, companyId: ctx.company.id, userId: { notIn: userIds } },
    });
    for (const userId of added) {
      await tx.projectMember.create({
        data: { companyId: ctx.company.id, projectId, userId },
      });
    }
  });

  for (const userId of added) {
    await recordTimeline({
      companyId: ctx.company.id,
      projectId,
      actorUserId: ctx.user.id,
      type: "project.member.assigned",
      description: "Team member assigned",
      entityType: "user",
      entityId: userId,
    });
  }
  await writeAuditLog({
    action: "project.members.update",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "project",
    entityId: projectId,
    ipAddress: meta.ip,
    metadata: { added, removed: removed.map((m) => m.userId) },
  });
  return getProject(ctx, projectId);
}

export async function transitionProject(
  ctx: AuthContext,
  id: string,
  action: "start" | "complete" | "hold",
  meta: { ip?: string | null },
) {
  if (!canStartAssignedJob(ctx) && !canEditProject(ctx)) {
    throw new AppError(403, "You do not have permission to do that.");
  }
  requirePermission(ctx, "projects.view");
  const project = await loadScopedProject(ctx, id);
  const key = action === "start" ? "in_progress" : action === "complete" ? "completed" : "on_hold";
  const status = await statusByKey(ctx.company.id, key);
  await prisma.project.update({
    where: { id: project.id },
    data: {
      projectStatusId: status.id,
      completedAt: action === "complete" ? new Date() : action === "start" ? null : undefined,
    },
  });
  const descriptions = {
    start: "Job started",
    complete: "Job completed",
    hold: "Job placed on hold",
  };
  const types = {
    start: "project.started",
    complete: "project.completed",
    hold: "project.on_hold",
  };
  await recordTimeline({
    companyId: ctx.company.id,
    projectId: project.id,
    actorUserId: ctx.user.id,
    type: types[action],
    description: descriptions[action],
    entityType: "project",
    entityId: project.id,
  });
  await writeAuditLog({
    action: types[action],
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "project",
    entityId: project.id,
    ipAddress: meta.ip,
  });
  const audience = await projectAudienceUserIds(ctx.company.id, project.id, ctx.user.id);
  await notifyUsers({
    companyId: ctx.company.id,
    userIds: audience,
    actorUserId: ctx.user.id,
    type: "project.status",
    title: descriptions[action],
    body: `${project.number} · ${project.name}`,
    entityType: "project",
    entityId: project.id,
    projectId: project.id,
  });
  return getProject(ctx, project.id);
}

export async function addProjectNote(ctx: AuthContext, projectId: string, body: string, visibility: "internal" | "customer" = "internal") {
  requirePermission(ctx, "projects.view");
  if (!canEditProject(ctx) && !canStartAssignedJob(ctx)) {
    throw new AppError(403, "You do not have permission to do that.");
  }
  await loadScopedProject(ctx, projectId);
  const trimmed = body.trim();
  if (!trimmed) throw new AppError(400, "Note cannot be empty.");
  const note = await prisma.projectNote.create({
    data: {
      companyId: ctx.company.id,
      projectId,
      authorId: ctx.user.id,
      body: trimmed,
      visibility,
    },
  });
  await recordTimeline({
    companyId: ctx.company.id,
    projectId,
    actorUserId: ctx.user.id,
    type: "project.note.added",
    description: visibility === "customer" ? "Customer-facing note added" : "Internal note added",
    entityType: "note",
    entityId: note.id,
  });
  const audience = await projectAudienceUserIds(ctx.company.id, projectId, ctx.user.id);
  await notifyUsers({
    companyId: ctx.company.id,
    userIds: audience,
    actorUserId: ctx.user.id,
    type: "project.note",
    title: `${ctx.user.firstName} added a note`,
    body: trimmed.slice(0, 280),
    entityType: "project",
    entityId: projectId,
    projectId,
  });
  return note;
}

export async function getDashboard(ctx: AuthContext) {
  requirePermission(ctx, "projects.view");
  const where = projectScopeWhere(ctx);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const now = new Date();

  const [active, today, attention, recent, memberCount, recentAudit] = await Promise.all([
    prisma.project.count({
      where: { ...where, projectStatus: { isTerminal: false } },
    }),
    prisma.project.findMany({
      where: { ...where, startDate: { gte: start, lt: end } },
      include: projectInclude,
      orderBy: { startDate: "asc" },
      take: 12,
    }) as Promise<ProjectListItem[]>,
    prisma.project.findMany({
      where: {
        ...where,
        projectStatus: { isTerminal: false },
        OR: [{ projectStatus: { key: "on_hold" } }, { expectedCompletionDate: { lt: now } }],
      },
      include: projectInclude,
      orderBy: { expectedCompletionDate: "asc" },
      take: 12,
    }) as Promise<ProjectListItem[]>,
    prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy: { updatedAt: "desc" },
      take: 8,
    }) as Promise<ProjectListItem[]>,
    prisma.companyMembership.count({
      where: { companyId: ctx.company.id, status: "active", deletedAt: null },
    }),
    prisma.auditLog.findMany({
      where: { companyId: ctx.company.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  return {
    company: ctx.company,
    role: ctx.role,
    stats: { activeProjects: active, members: memberCount, today: today.length, attention: attention.length },
    today,
    attention,
    recent,
    recentAudit: recentAudit.map((row) => ({
      id: row.id,
      action: row.action,
      createdAt: row.createdAt,
      actor: row.user ? `${row.user.firstName} ${row.user.lastName}` : "System",
    })),
  };
}

export async function listCalendarProjects(ctx: AuthContext, from: Date, to: Date) {
  requirePermission(ctx, "projects.view");
  return prisma.project.findMany({
    where: {
      ...projectScopeWhere(ctx),
      startDate: { gte: from, lt: to },
    },
    include: projectInclude,
    orderBy: { startDate: "asc" },
    take: 200,
  });
}
