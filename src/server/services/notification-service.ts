import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/http";
import { sendCompanyEmail } from "@/server/services/integration-service";
import { fanoutRealtime } from "@/server/realtime-bus";
import { NOTIFICATION_EVENTS } from "@/lib/mentions";

export async function projectAudienceUserIds(companyId: string, projectId: string, exceptUserId?: string) {
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });
  let ids = members.map((row) => row.userId);
  if (ids.length === 0) {
    const office = await prisma.companyMembership.findMany({
      where: {
        companyId,
        status: "active",
        deletedAt: null,
        role: { key: { in: ["owner", "admin", "manager", "office"] } },
      },
      select: { userId: true },
    });
    ids = office.map((row) => row.userId);
  }
  return [...new Set(ids)].filter((id) => id !== exceptUserId);
}

export async function notifyUsers(input: {
  companyId: string;
  userIds: string[];
  actorUserId?: string | null;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  projectId?: string | null;
}) {
  const recipients = [...new Set(input.userIds)].filter((id) => id && id !== input.actorUserId);
  if (recipients.length === 0) return [];
  const created = [];
  for (const userId of recipients) {
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId_eventType: { userId, eventType: input.type } },
    });
    const inApp = pref ? pref.inApp : true;
    const email = pref ? pref.email : false;
    if (inApp) {
      const row = await prisma.notification.create({
        data: {
          companyId: input.companyId,
          userId,
          type: input.type,
          title: input.title,
          body: input.body,
          entityType: input.entityType,
          entityId: input.entityId,
        },
      });
      created.push(row);
    }
    if (email) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        await sendCompanyEmail(input.companyId, {
          to: user.email,
          subject: input.title,
          text: input.body,
        });
      }
    }
  }
  await fanoutRealtime({
    companyId: input.companyId,
    projectId: input.projectId ?? undefined,
    type: "notification.created",
    payload: { count: created.length, type: input.type },
  });
  return created;
}

export async function listNotifications(ctx: AuthContext, unreadOnly = false) {
  requirePermission(ctx, "projects.view");
  return prisma.notification.findMany({
    where: {
      companyId: ctx.company.id,
      userId: ctx.user.id,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function unreadCount(ctx: AuthContext) {
  requirePermission(ctx, "projects.view");
  return prisma.notification.count({
    where: { companyId: ctx.company.id, userId: ctx.user.id, readAt: null },
  });
}

export async function markNotificationRead(ctx: AuthContext, id: string) {
  const row = await prisma.notification.findFirst({
    where: { id, companyId: ctx.company.id, userId: ctx.user.id },
  });
  if (!row) throw new AppError(404, "Not found.");
  return prisma.notification.update({ where: { id: row.id }, data: { readAt: new Date() } });
}

export async function markAllRead(ctx: AuthContext) {
  await prisma.notification.updateMany({
    where: { companyId: ctx.company.id, userId: ctx.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}

export async function listNotificationPreferences(ctx: AuthContext) {
  const rows = await prisma.notificationPreference.findMany({ where: { userId: ctx.user.id } });
  const byKey = new Map(rows.map((row) => [row.eventType, row]));
  return NOTIFICATION_EVENTS.map((event) => {
    const row = byKey.get(event.key);
    return {
      eventType: event.key,
      label: event.label,
      inApp: row?.inApp ?? true,
      email: row?.email ?? false,
      push: row?.push ?? false,
    };
  });
}

export async function upsertNotificationPreference(
  ctx: AuthContext,
  eventType: string,
  input: { inApp?: boolean; email?: boolean },
) {
  if (!NOTIFICATION_EVENTS.some((event) => event.key === eventType)) {
    throw new AppError(400, "Unknown notification event.");
  }
  return prisma.notificationPreference.upsert({
    where: { userId_eventType: { userId: ctx.user.id, eventType } },
    update: {
      inApp: input.inApp,
      email: input.email,
    },
    create: {
      userId: ctx.user.id,
      eventType,
      inApp: input.inApp ?? true,
      email: input.email ?? false,
    },
  });
}
