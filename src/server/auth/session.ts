import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { randomToken, sha256 } from "@/server/crypto";
import { SESSION_COOKIE, readSessionToken } from "@/server/auth/context";

export { readSessionToken };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(input: {
  userId: string;
  companyId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const token = randomToken();
  await prisma.session.create({
    data: {
      userId: input.userId,
      companyId: input.companyId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
  await setSessionCookie(token);
  return token;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || (process.env.APP_URL ?? "").startsWith("https:"),
    path: "/",
    maxAge: THIRTY_DAYS_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function destroySessionByToken(token: string | null) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  await clearSessionCookie();
}
