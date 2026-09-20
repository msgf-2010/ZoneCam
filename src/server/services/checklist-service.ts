import { z } from "zod";
import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/http";
import { recordTimeline } from "@/server/timeline";
import { signedMediaPath } from "@/server/adapters/storage";
import { loadScopedProject } from "@/server/tenancy/access";

const DEFAULT_TEMPLATES = [
  {
    name: "Pre-Job Inspection",
    description: "Confirm site conditions before work starts.",
    items: [
      "Verify equipment",
      "Photograph existing damage",
      "Confirm measurements",
      "Confirm materials",
      "Customer approval",
    ],
  },
  {
    name: "Post-Job Closeout",
    description: "Finish documentation before marking the job complete.",
    items: ["Photograph completed work", "Clean job site", "Customer walkthrough"],
  },
];

function actorName(ctx: AuthContext) {
  return `${ctx.user.firstName} ${ctx.user.lastName}`.trim();
}

export async function ensureDefaultChecklistTemplates(companyId: string) {
  const count = await prisma.checklistTemplate.count({ where: { companyId } });
  if (count > 0) return;
  for (const template of DEFAULT_TEMPLATES) {
    await prisma.checklistTemplate.create({
      data: {
        companyId,
        name: template.name,
        description: template.description,
        items: {
          create: template.items.map((title, sortOrder) => ({ title, sortOrder })),
        },
      },
    });
  }
}

const templateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  items: z.array(z.string().trim().min(1).max(200)).min(1).max(80),
});

export async function listChecklistTemplates(ctx: AuthContext) {
  requirePermission(ctx, "tasks.view");
  await ensureDefaultChecklistTemplates(ctx.company.id);
  return prisma.checklistTemplate.findMany({
    where: { companyId: ctx.company.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export async function createChecklistTemplate(ctx: AuthContext, input: unknown) {
  requirePermission(ctx, "tasks.create");
  const data = templateSchema.parse(input);
  return prisma.checklistTemplate.create({
    data: {
      companyId: ctx.company.id,
      name: data.name,
      description: data.description ?? "",
      items: {
        create: data.items.map((title, sortOrder) => ({ title, sortOrder })),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function updateChecklistTemplate(ctx: AuthContext, id: string, input: unknown) {
  requirePermission(ctx, "tasks.edit");
  const existing = await prisma.checklistTemplate.findFirst({
    where: { id, companyId: ctx.company.id },
  });
  if (!existing) throw new AppError(404, "Not found.");
  const data = templateSchema.parse(input);
  await prisma.checklistTemplateItem.deleteMany({ where: { templateId: existing.id } });
  return prisma.checklistTemplate.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      description: data.description ?? "",
      items: {
        create: data.items.map((title, sortOrder) => ({ title, sortOrder })),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function listProjectChecklists(ctx: AuthContext, projectId: string) {
  requirePermission(ctx, "tasks.view");
  await loadScopedProject(ctx, projectId);
  const lists = await prisma.checklist.findMany({
    where: { companyId: ctx.company.id, projectId, deletedAt: null },
    include: { items: { orderBy: { sortOrder: "asc" } }, template: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return lists.map((list) => ({
    ...list,
    sourceMediaUrl: list.sourceMediaId ? signedMediaPath(list.sourceMediaId, "original") : null,
    items: list.items.map((item) => ({
      ...item,
      screenshotUrl: item.screenshotMediaId ? signedMediaPath(item.screenshotMediaId, "thumbnail") : null,
    })),
  }));
}

export async function applyChecklistTemplate(ctx: AuthContext, projectId: string, templateId: string) {
  requirePermission(ctx, "tasks.create");
  await loadScopedProject(ctx, projectId);
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, companyId: ctx.company.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) throw new AppError(404, "Template not found.");
  const checklist = await prisma.checklist.create({
    data: {
      companyId: ctx.company.id,
      projectId,
      templateId: template.id,
      name: template.name,
      items: {
        create: template.items.map((item) => ({
          companyId: ctx.company.id,
          title: item.title,
          sortOrder: item.sortOrder,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  await recordTimeline({
    companyId: ctx.company.id,
    projectId,
    actorUserId: ctx.user.id,
    type: "checklist.created",
    description: `${actorName(ctx)} added checklist “${checklist.name}”`,
    entityType: "checklist",
    entityId: checklist.id,
  });
  return checklist;
}

export async function createProjectChecklist(ctx: AuthContext, projectId: string, input: unknown) {
  requirePermission(ctx, "tasks.create");
  await loadScopedProject(ctx, projectId);
  const data = z
    .object({
      name: z.string().trim().min(1).max(120),
      items: z.array(z.string().trim().min(1).max(200)).min(1).max(80),
    })
    .parse(input);
  const checklist = await prisma.checklist.create({
    data: {
      companyId: ctx.company.id,
      projectId,
      name: data.name,
      items: {
        create: data.items.map((title, sortOrder) => ({
          companyId: ctx.company.id,
          title,
          sortOrder,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  await recordTimeline({
    companyId: ctx.company.id,
    projectId,
    actorUserId: ctx.user.id,
    type: "checklist.created",
    description: `${actorName(ctx)} added checklist “${checklist.name}”`,
    entityType: "checklist",
    entityId: checklist.id,
  });
  return checklist;
}

export async function setChecklistItemComplete(ctx: AuthContext, itemId: string, isComplete: boolean) {
  requirePermission(ctx, "tasks.complete");
  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, companyId: ctx.company.id },
    include: { checklist: true },
  });
  if (!item || item.checklist.deletedAt) throw new AppError(404, "Not found.");
  if (item.checklist.projectId) await loadScopedProject(ctx, item.checklist.projectId);
  const updated = await prisma.checklistItem.update({
    where: { id: item.id },
    data: { isComplete, completedAt: isComplete ? new Date() : null },
    include: { checklist: { include: { items: true } } },
  });
  if (isComplete) {
    const remaining = updated.checklist.items.filter((row) => row.id !== item.id && !row.isComplete).length;
    await recordTimeline({
      companyId: ctx.company.id,
      projectId: item.checklist.projectId,
      actorUserId: ctx.user.id,
      type: remaining === 0 ? "checklist.completed" : "checklist.item_completed",
      description:
        remaining === 0
          ? `${actorName(ctx)} completed checklist “${item.checklist.name}”`
          : `${actorName(ctx)} checked “${item.title}”`,
      entityType: "checklist",
      entityId: item.checklistId,
    });
  }
  return updated;
}
