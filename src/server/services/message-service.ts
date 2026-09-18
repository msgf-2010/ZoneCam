import { z } from "zod";
import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/http";
import { recordTimeline } from "@/server/timeline";
import { loadScopedProject } from "@/server/tenancy/access";
import { parseMentionIds } from "@/lib/mentions";
import { notifyUsers, projectAudienceUserIds } from "@/server/services/notification-service";

export async function listProjectMessages(ctx: AuthContext, projectId: string) {
  requirePermission(ctx, "projects.view");
  await loadScopedProject(ctx, projectId);
  return prisma.comment.findMany({
    where: {
      companyId: ctx.company.id,
      projectId,
      parentType: "project",
      parentId: projectId,
      deletedAt: null,
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      mentions: true,
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
}

export async function listMessageThreads(ctx: AuthContext) {
  requirePermission(ctx, "projects.view");
  const comments = await prisma.comment.findMany({
    where: { companyId: ctx.company.id, parentType: "project", deletedAt: null, projectId: { not: null } },
    include: {
      author: { select: { firstName: true, lastName: true } },
      project: { select: { id: true, name: true, number: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const seen = new Set<string>();
  const threads = [];
  for (const row of comments) {
    if (!row.projectId || seen.has(row.projectId)) continue;
    seen.add(row.projectId);
    threads.push(row);
  }
  return threads;
}

export async function postProjectMessage(ctx: AuthContext, projectId: string, input: unknown) {
  requirePermission(ctx, "projects.view");
  const project = await loadScopedProject(ctx, projectId);
  const data = z.object({ body: z.string().trim().min(1).max(4000) }).parse(input);
  const people = await prisma.companyMembership.findMany({
    where: { companyId: ctx.company.id, status: "active", deletedAt: null },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  const mentionIds = parseMentionIds(
    data.body,
    people.map((row) => row.user),
  );
  const comment = await prisma.comment.create({
    data: {
      companyId: ctx.company.id,
      projectId: project.id,
      authorId: ctx.user.id,
      body: data.body,
      parentType: "project",
      parentId: project.id,
      mentions: {
        create: mentionIds.map((userId) => ({ userId })),
      },
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      mentions: true,
    },
  });
  await recordTimeline({
    companyId: ctx.company.id,
    projectId: project.id,
    actorUserId: ctx.user.id,
    type: "comment.added",
    description: `${ctx.user.firstName} posted a message`,
    entityType: "comment",
    entityId: comment.id,
  });
  const audience = await projectAudienceUserIds(ctx.company.id, project.id, ctx.user.id);
  await notifyUsers({
    companyId: ctx.company.id,
    userIds: audience,
    actorUserId: ctx.user.id,
    type: "project.message",
    title: `${ctx.user.firstName} messaged ${project.number}`,
    body: data.body.slice(0, 280),
    entityType: "project",
    entityId: project.id,
    projectId: project.id,
  });
  if (mentionIds.length) {
    await notifyUsers({
      companyId: ctx.company.id,
      userIds: mentionIds,
      actorUserId: ctx.user.id,
      type: "mention",
      title: `${ctx.user.firstName} mentioned you`,
      body: data.body.slice(0, 280),
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
    });
  }
  return comment;
}
