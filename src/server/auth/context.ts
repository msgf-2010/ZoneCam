import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { sha256 } from "@/server/crypto";
import { AppError } from "@/server/http";
import type { PermissionKey } from "@/server/rbac/catalog";
import { syncCompanyRbac } from "@/server/tenancy/provision";

export const SESSION_COOKIE = "zonecam_session";

const rbacSynced = new Set<string>();

const membershipInclude = {
  company: true,
  role: { include: { permissions: { include: { permission: true } } } },
} as const;

export type AuthContext = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    emailVerifiedAt: Date | null;
  };
  sessionId: string;
  company: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  membershipId: string;
  role: { id: string; key: string; name: string };
  permissions: Set<string>;
};

export async function readSessionToken(request?: Request) {
  const header = request?.headers.get("authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export const loadAuthContext = cache(async function loadAuthContext(request?: Request): Promise<AuthContext | null> {
  const token = await readSessionToken(request);
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: true,
    },
  });
  if (!session || session.expiresAt < new Date() || session.user.deletedAt) {
    return null;
  }

  const membership = await prisma.companyMembership.findFirst({
    where: {
      userId: session.userId,
      status: "active",
      deletedAt: null,
      company: { deletedAt: null },
      ...(session.companyId ? { companyId: session.companyId } : {}),
    },
    include: membershipInclude,
    orderBy: { createdAt: "asc" },
  });

  if (!membership) return null;

  if (!rbacSynced.has(membership.companyId)) {
    rbacSynced.add(membership.companyId);
    if (membership.role.permissions.length === 0) {
      await syncCompanyRbac(prisma, membership.companyId);
      const refreshed = await prisma.companyMembership.findUnique({
        where: { id: membership.id },
        include: membershipInclude,
      });
      if (refreshed) Object.assign(membership, refreshed);
    }
  }

  if (session.companyId !== membership.companyId) {
    await prisma.session.update({
      where: { id: session.id },
      data: { companyId: membership.companyId },
    });
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      phone: session.user.phone,
      emailVerifiedAt: session.user.emailVerifiedAt,
    },
    sessionId: session.id,
    company: {
      id: membership.company.id,
      name: membership.company.name,
      slug: membership.company.slug,
      timezone: membership.company.timezone,
    },
    membershipId: membership.id,
    role: { id: membership.role.id, key: membership.role.key, name: membership.role.name },
    permissions: new Set(membership.role.permissions.map((rp) => rp.permission.key)),
  };
});

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await loadAuthContext();
  if (!ctx) throw new AppError(401, "Not authenticated.");
  return ctx;
}

export function requirePermission(ctx: AuthContext, permission: PermissionKey) {
  if (!ctx.permissions.has(permission)) {
    throw new AppError(403, "You do not have permission to do that.");
  }
}

export function serializeAuth(ctx: AuthContext, token?: string) {
  return {
    user: ctx.user,
    company: ctx.company,
    role: ctx.role,
    permissions: [...ctx.permissions],
    ...(token ? { token } : {}),
  };
}
