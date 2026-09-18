import type { AuthContext } from "@/server/auth/context";
import { prisma } from "@/server/db";
import { AppError } from "@/server/http";
import type { Prisma } from "@prisma/client";

export function isAssignedOnlyRole(ctx: AuthContext) {
  return ctx.role.key === "field_technician";
}

export function projectScopeWhere(ctx: AuthContext): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {
    companyId: ctx.company.id,
    deletedAt: null,
  };
  if (isAssignedOnlyRole(ctx)) {
    where.members = { some: { userId: ctx.user.id } };
  }
  return where;
}

export async function loadScopedProject(ctx: AuthContext, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectScopeWhere(ctx) },
  });
  if (!project) throw new AppError(404, "Not found.");
  return project;
}

export function canEditProject(ctx: AuthContext) {
  return ctx.permissions.has("projects.edit");
}

export function canStartAssignedJob(ctx: AuthContext) {
  return ctx.permissions.has("projects.edit") || isAssignedOnlyRole(ctx);
}
