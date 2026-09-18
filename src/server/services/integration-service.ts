import { z } from "zod";
import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/http";
import { writeAuditLog } from "@/server/audit";
import { encryptSecret } from "@/server/crypto";
import { sha256 } from "@/server/crypto";
import { createEmailService, type EmailMessage } from "@/server/adapters/email";
import { getIntegrationConnector, INTEGRATION_PROVIDER_KEYS, type IntegrationProviderKey } from "@/server/adapters/integrations";
import { buildJobCalendarIcs } from "@/server/integrations/ics";
import { isAssignedOnlyRole } from "@/server/tenancy/access";

function parseSettings(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function serializeSettings(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

function assertOfficeIntegrations(ctx: AuthContext) {
  if (isAssignedOnlyRole(ctx)) throw new AppError(403, "Integrations are office-only.");
}

async function ensureCatalog(companyId: string) {
  for (const key of INTEGRATION_PROVIDER_KEYS) {
    await prisma.integration.upsert({
      where: { companyId_provider: { companyId, provider: key } },
      update: {},
      create: { companyId, provider: key, status: "not_configured", settings: "{}" },
    });
  }
}

async function loadOwned(ctx: AuthContext, provider: string) {
  requirePermission(ctx, "integrations.view");
  assertOfficeIntegrations(ctx);
  const connector = getIntegrationConnector(provider);
  await ensureCatalog(ctx.company.id);
  const row = await prisma.integration.findUnique({
    where: { companyId_provider: { companyId: ctx.company.id, provider: connector.key } },
    include: { logs: { orderBy: { createdAt: "desc" }, take: 40 } },
  });
  if (!row) throw new AppError(404, "Not found.");
  return { connector, row };
}

async function writeLog(integrationId: string, level: string, message: string, metadata: Record<string, unknown> = {}) {
  await prisma.integrationLog.create({
    data: { integrationId, level, message, metadata: JSON.stringify(metadata) },
  });
}

export function publicIntegrationCard(input: {
  provider: string;
  name: string;
  description: string;
  available: boolean;
  status: string;
  settings: Record<string, unknown>;
  updatedAt: Date;
}) {
  const { feedTokenHash: _hash, ...safeSettings } = input.settings;
  return {
    provider: input.provider,
    name: input.name,
    description: input.description,
    available: input.available,
    status: input.status,
    settings: safeSettings,
    updatedAt: input.updatedAt,
  };
}

export async function listIntegrations(ctx: AuthContext) {
  requirePermission(ctx, "integrations.view");
  assertOfficeIntegrations(ctx);
  await ensureCatalog(ctx.company.id);
  const rows = await prisma.integration.findMany({
    where: { companyId: ctx.company.id },
  });
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  return INTEGRATION_PROVIDER_KEYS.map((key) => {
    const connector = getIntegrationConnector(key);
    const row = byProvider.get(key);
    return publicIntegrationCard({
      provider: key,
      name: connector.name,
      description: connector.description,
      available: connector.available,
      status: row?.status ?? "not_configured",
      settings: parseSettings(row?.settings ?? "{}"),
      updatedAt: row?.updatedAt ?? new Date(),
    });
  });
}

export async function getIntegration(ctx: AuthContext, provider: string) {
  const { connector, row } = await loadOwned(ctx, provider);
  return {
    ...publicIntegrationCard({
      provider: connector.key,
      name: connector.name,
      description: connector.description,
      available: connector.available,
      status: row.status,
      settings: parseSettings(row.settings),
      updatedAt: row.updatedAt,
    }),
    syncHint: connector.syncHint(),
    logs: row.logs.map((log) => ({
      id: log.id,
      level: log.level,
      message: log.message,
      createdAt: log.createdAt,
    })),
  };
}

export async function connectIntegration(ctx: AuthContext, provider: string) {
  requirePermission(ctx, "integrations.manage");
  const { connector, row } = await loadOwned(ctx, provider);
  const result = connector.connect();
  await prisma.integration.update({
    where: { id: row.id },
    data: {
      status: "connected",
      settings: serializeSettings(result.settings),
    },
  });
  await prisma.integrationCredential.deleteMany({ where: { integrationId: row.id } });
  if (result.credentialPlain) {
    await prisma.integrationCredential.create({
      data: { integrationId: row.id, encryptedPayload: encryptSecret(result.credentialPlain) },
    });
  }
  await writeLog(row.id, "info", result.log);
  await writeAuditLog({
    action: "integration.connected",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "integration",
    entityId: row.id,
    metadata: { provider: connector.key },
  });
  return { ...result.reveal, provider: connector.key, status: "connected" as const };
}

export async function disconnectIntegration(ctx: AuthContext, provider: string) {
  requirePermission(ctx, "integrations.manage");
  const { connector, row } = await loadOwned(ctx, provider);
  await prisma.integrationCredential.deleteMany({ where: { integrationId: row.id } });
  await prisma.integration.update({
    where: { id: row.id },
    data: { status: "disconnected", settings: "{}" },
  });
  await writeLog(row.id, "info", `${connector.name} disconnected.`);
  await writeAuditLog({
    action: "integration.disconnected",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "integration",
    entityId: row.id,
    metadata: { provider: connector.key },
  });
  return { provider: connector.key, status: "disconnected" as const };
}

export async function updateIntegrationSettings(ctx: AuthContext, provider: string, input: unknown) {
  requirePermission(ctx, "integrations.manage");
  const { connector, row } = await loadOwned(ctx, provider);
  if (connector.key !== "calendar") throw new AppError(400, "This integration has no editable settings yet.");
  if (row.status !== "connected") throw new AppError(400, "Connect the calendar before changing settings.");
  const data = z.object({ includeCompleted: z.boolean() }).parse(input);
  const settings = parseSettings(row.settings);
  settings.includeCompleted = data.includeCompleted;
  await prisma.integration.update({
    where: { id: row.id },
    data: { settings: serializeSettings(settings) },
  });
  await writeLog(row.id, "info", `Calendar settings updated (includeCompleted=${data.includeCompleted}).`);
  return getIntegration(ctx, provider);
}

export async function syncIntegration(ctx: AuthContext, provider: string) {
  requirePermission(ctx, "integrations.manage");
  const { connector, row } = await loadOwned(ctx, provider);
  if (!connector.available) {
    await writeLog(row.id, "error", connector.syncHint());
    await prisma.integration.update({ where: { id: row.id }, data: { status: row.status === "connected" ? "error" : row.status } });
    throw new AppError(400, connector.syncHint());
  }
  if (row.status !== "connected") throw new AppError(400, `Connect ${connector.name} first.`);

  if (connector.key === "email") {
    const message: EmailMessage = {
      to: ctx.user.email,
      subject: `ZoneCam email test · ${ctx.company.name}`,
      text: "This is a real test from the ZoneCam email integration. It uses the console mail adapter until SMTP is connected.",
    };
    await createEmailService().send(message);
    await writeLog(row.id, "info", `Test message sent to ${message.to}.`, { to: message.to, subject: message.subject });
    return { ok: true, message: "Test email sent through the console adapter. Check the server log." };
  }

  if (connector.key === "calendar") {
    const jobs = await loadCalendarJobs(ctx.company.id, parseSettings(row.settings).includeCompleted !== false);
    await writeLog(row.id, "info", `Calendar feed synced (${jobs.length} dated job${jobs.length === 1 ? "" : "s"}).`, {
      count: jobs.length,
    });
    return { ok: true, message: `Feed now includes ${jobs.length} dated job${jobs.length === 1 ? "" : "s"}.` };
  }

  throw new AppError(400, connector.syncHint());
}

async function loadCalendarJobs(companyId: string, includeCompleted: boolean) {
  return prisma.project.findMany({
    where: {
      companyId,
      deletedAt: null,
      startDate: { not: null },
      ...(includeCompleted ? {} : { completedAt: null }),
    },
    include: { projectStatus: true },
    orderBy: { startDate: "asc" },
    take: 200,
  });
}

export async function getPublicCalendarIcs(token: string) {
  const hash = sha256(token);
  const rows = await prisma.integration.findMany({
    where: { provider: "calendar", status: "connected" },
    include: { company: true },
  });
  const integration = rows.find((row) => parseSettings(row.settings).feedTokenHash === hash);
  if (!integration) throw new AppError(404, "Not found.");
  const includeCompleted = parseSettings(integration.settings).includeCompleted !== false;
  const projects = await loadCalendarJobs(integration.companyId, includeCompleted);
  const ics = buildJobCalendarIcs({
    companyName: integration.company.name,
    jobs: projects.map((project) => ({
      id: project.id,
      number: project.number,
      name: project.name,
      status: project.projectStatus.name,
      startDate: project.startDate!,
      expectedCompletionDate: project.expectedCompletionDate,
    })),
  });
  return { ics, filename: `${integration.company.slug}-jobs.ics` };
}

export async function logCompanyEmail(companyId: string, message: EmailMessage) {
  const integration = await prisma.integration.findUnique({
    where: { companyId_provider: { companyId, provider: "email" satisfies IntegrationProviderKey } },
  });
  if (integration?.status !== "connected") return;
  await writeLog(integration.id, "info", `Sent to ${message.to}: ${message.subject}`, {
    to: message.to,
    subject: message.subject,
  });
}

export async function sendCompanyEmail(companyId: string, message: EmailMessage) {
  await createEmailService().send(message);
  await logCompanyEmail(companyId, message);
}
