import { z } from "zod";
import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { writeAuditLog } from "@/server/audit";
import { AppError } from "@/server/http";
import { randomToken, sha256 } from "@/server/crypto";
import { sendCompanyEmail } from "@/server/services/integration-service";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/server/auth/password";

const companyPatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  timezone: z.string().trim().min(3).max(80).optional(),
});

const profilePatchSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
});

const inviteSchema = z.object({
  email: z.string().trim().email(),
  roleKey: z.string().trim().min(1),
});

export async function getCompanyOverview(ctx: AuthContext) {
  const [memberCount, projectCount, recentAudit] = await Promise.all([
    prisma.companyMembership.count({
      where: { companyId: ctx.company.id, status: "active", deletedAt: null },
    }),
    prisma.project.count({
      where: { companyId: ctx.company.id, deletedAt: null },
    }),
    prisma.auditLog.findMany({
      where: { companyId: ctx.company.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    }),
  ]);

  return {
    company: ctx.company,
    role: ctx.role,
    stats: {
      members: memberCount,
      projects: projectCount,
    },
    recentAudit: recentAudit.map((row) => ({
      id: row.id,
      action: row.action,
      createdAt: row.createdAt,
      actor: row.user ? `${row.user.firstName} ${row.user.lastName}` : "System",
    })),
  };
}

export async function updateCompany(ctx: AuthContext, input: unknown, meta: { ip?: string | null }) {
  requirePermission(ctx, "company.settings");
  const data = companyPatchSchema.parse(input);
  const company = await prisma.company.update({
    where: { id: ctx.company.id },
    data,
  });
  await writeAuditLog({
    action: "company.update",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "company",
    entityId: company.id,
    ipAddress: meta.ip,
    metadata: data,
  });
  return company;
}

export async function updateProfile(ctx: AuthContext, input: unknown) {
  const data = profilePatchSchema.parse(input);
  return prisma.user.update({
    where: { id: ctx.user.id },
    data,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      emailVerifiedAt: true,
    },
  });
}

export async function listMembers(ctx: AuthContext) {
  requirePermission(ctx, "users.view");
  const members = await prisma.companyMembership.findMany({
    where: { companyId: ctx.company.id, deletedAt: null },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, emailVerifiedAt: true } },
      role: { select: { key: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return members.map((m) => ({
    id: m.id,
    status: m.status,
    role: m.role,
    user: m.user,
  }));
}

export async function listRoles(ctx: AuthContext) {
  const roles = await prisma.role.findMany({
    where: { companyId: ctx.company.id },
    include: { permissions: { include: { permission: true } } },
    orderBy: { name: "asc" },
  });
  return roles.map((role) => ({
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.permissions.map((p) => p.permission.key),
  }));
}

export async function inviteMember(ctx: AuthContext, input: unknown, meta: { ip?: string | null }) {
  requirePermission(ctx, "users.manage");
  const data = inviteSchema.parse(input);
  const email = data.email.toLowerCase();
  const role = await prisma.role.findUnique({
    where: { companyId_key: { companyId: ctx.company.id, key: data.roleKey } },
  });
  if (!role) throw new AppError(400, "Unknown role.");

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId: ctx.company.id, userId: existingUser.id } },
    });
    if (existingMembership && !existingMembership.deletedAt) {
      throw new AppError(409, "That person is already in this company.");
    }
  }

  const token = randomToken();
  await prisma.companyInvite.create({
    data: {
      companyId: ctx.company.id,
      email,
      roleId: role.id,
      tokenHash: sha256(token),
      invitedById: ctx.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  const url = `${getEnv().APP_URL}/invite?token=${encodeURIComponent(token)}`;
  await sendCompanyEmail(ctx.company.id, {
    to: email,
    subject: `Join ${ctx.company.name} on ZoneCam`,
    text: `You were invited to ${ctx.company.name} as ${role.name}.\nAccept: ${url}`,
  });
  await writeAuditLog({
    action: "users.invite",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "invite",
    ipAddress: meta.ip,
    metadata: { email, roleKey: role.key },
  });
  return { email, role: { key: role.key, name: role.name } };
}

const acceptInviteSchema = z.object({
  token: z.string().min(10),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  password: z.string().min(10).max(200).optional(),
});

export async function acceptInvite(input: unknown, meta: { ip?: string | null; userAgent?: string | null }) {
  const data = acceptInviteSchema.parse(input);
  const invite = await prisma.companyInvite.findUnique({
    where: { tokenHash: sha256(data.token) },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new AppError(400, "This invite is invalid or expired.");
  }

  let user = await prisma.user.findUnique({ where: { email: invite.email } });
  if (!user) {
    if (!data.firstName || !data.lastName || !data.password) {
      throw new AppError(400, "Name and password are required to create your account.");
    }
    user = await prisma.user.create({
      data: {
        email: invite.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash: await hashPassword(data.password),
        emailVerifiedAt: new Date(),
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.companyMembership.upsert({
      where: { companyId_userId: { companyId: invite.companyId, userId: user!.id } },
      update: { roleId: invite.roleId, status: "active", deletedAt: null },
      create: {
        companyId: invite.companyId,
        userId: user!.id,
        roleId: invite.roleId,
        status: "active",
      },
    });
    await tx.companyInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  });

  const { createSession } = await import("@/server/auth/session");
  await createSession({
    userId: user.id,
    companyId: invite.companyId,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  await writeAuditLog({
    action: "users.invite.accept",
    companyId: invite.companyId,
    userId: user.id,
    entityType: "user",
    entityId: user.id,
    ipAddress: meta.ip,
  });
}

export async function switchCompany(ctx: AuthContext, companyId: string) {
  const membership = await prisma.companyMembership.findFirst({
    where: {
      companyId,
      userId: ctx.user.id,
      status: "active",
      deletedAt: null,
      company: { deletedAt: null },
    },
  });
  if (!membership) throw new AppError(403, "You do not belong to that company.");
  await prisma.session.update({
    where: { id: ctx.sessionId },
    data: { companyId },
  });
}

export async function listAuditLogs(ctx: AuthContext) {
  requirePermission(ctx, "audit.view");
  const rows = await prisma.auditLog.findMany({
    where: { companyId: ctx.company.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt,
    ipAddress: row.ipAddress,
    actor: row.user ? `${row.user.firstName} ${row.user.lastName}` : "System",
  }));
}
