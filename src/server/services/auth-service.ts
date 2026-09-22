import { z } from "zod";
import { prisma } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroySessionByToken, readSessionToken } from "@/server/auth/session";
import { randomToken, sha256, slugify } from "@/server/crypto";
import { provisionCompanyDefaults } from "@/server/tenancy/provision";
import { writeAuditLog } from "@/server/audit";
import { AppError } from "@/server/http";
import { createEmailService } from "@/server/adapters/email";
import { getEnv } from "@/lib/env";
import { loadAuthContext, serializeAuth } from "@/server/auth/context";

const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(10).max(200),
  companyName: z.string().trim().min(2).max(120),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function publicUser(user: { id: string; email: string; firstName: string; lastName: string; phone: string | null; emailVerifiedAt: Date | null }) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

async function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let i = 0;
  while (await prisma.company.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

async function sendVerification(userId: string, email: string) {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  const token = randomToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const url = `${getEnv().APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await createEmailService().send({
    to: email,
    subject: "Verify your ZoneCam email",
    text: `Confirm your email by opening:\n${url}\nThis link expires in 24 hours.`,
  });
}

export async function registerAccount(input: unknown, meta: { ip?: string | null; userAgent?: string | null }) {
  const data = registerSchema.parse(input);
  const email = data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "An account with that email already exists.");

  const slug = await uniqueSlug(data.companyName);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(data.password),
      firstName: data.firstName,
      lastName: data.lastName,
    },
  });
  let result: { user: typeof user; company: { id: string } };
  try {
    const company = await prisma.company.create({
      data: {
        name: data.companyName,
        slug,
      },
    });
    await provisionCompanyDefaults(prisma, company.id);
    const ownerRole = await prisma.role.findUniqueOrThrow({
      where: { companyId_key: { companyId: company.id, key: "owner" } },
    });
    await prisma.companyMembership.create({
      data: {
        companyId: company.id,
        userId: user.id,
        roleId: ownerRole.id,
        status: "active",
      },
    });
    result = { user, company };
  } catch (error) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    throw error;
  }

  await sendVerification(result.user.id, result.user.email);
  const token = await createSession({
    userId: result.user.id,
    companyId: result.company.id,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  await writeAuditLog({
    action: "auth.register",
    companyId: result.company.id,
    userId: result.user.id,
    entityType: "user",
    entityId: result.user.id,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  const ctx = await loadAuthContext();
  return serializeAuth(ctx!, token);
}

export async function login(input: unknown, meta: { ip?: string | null; userAgent?: string | null }) {
  const data = loginSchema.parse(input);
  const email = data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) throw new AppError(401, "Invalid email or password.");
  const ok = await verifyPassword(data.password, user.passwordHash);
  if (!ok) throw new AppError(401, "Invalid email or password.");

  const membership = await prisma.companyMembership.findFirst({
    where: { userId: user.id, status: "active", deletedAt: null, company: { deletedAt: null } },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new AppError(403, "This account has no active company membership.");

  const token = await createSession({
    userId: user.id,
    companyId: membership.companyId,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  await writeAuditLog({
    action: "auth.login",
    companyId: membership.companyId,
    userId: user.id,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  const ctx = await loadAuthContext();
  return serializeAuth(ctx!, token);
}

export async function logout(meta: { ip?: string | null; userAgent?: string | null; userId?: string; companyId?: string; request?: Request }) {
  const token = await readSessionToken(meta.request);
  await destroySessionByToken(token);
  if (meta.userId) {
    await writeAuditLog({
      action: "auth.logout",
      companyId: meta.companyId,
      userId: meta.userId,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}

export async function verifyEmail(token: string) {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!record || record.expiresAt < new Date()) {
    throw new AppError(400, "This verification link is invalid or expired.");
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.delete({ where: { id: record.id } }),
  ]);
}

export async function resendVerification(userId: string, email: string) {
  await sendVerification(userId, email);
}

export async function requestPasswordReset(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  // Do not reveal whether the email exists.
  if (!user || user.deletedAt) return;
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  const token = randomToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const url = `${getEnv().APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await createEmailService().send({
    to: user.email,
    subject: "Reset your ZoneCam password",
    text: `Reset your password:\n${url}\nThis link expires in 1 hour.`,
  });
}

export async function resetPassword(token: string, password: string) {
  if (password.length < 10) throw new AppError(400, "Password must be at least 10 characters.");
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!record || record.expiresAt < new Date()) {
    throw new AppError(400, "This reset link is invalid or expired.");
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(password) },
    }),
    prisma.passwordResetToken.delete({ where: { id: record.id } }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
}

export { publicUser };
