import { z } from "zod";
import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/http";
import { writeAuditLog } from "@/server/audit";
import { recordTimeline } from "@/server/timeline";
import { loadScopedProject, projectScopeWhere, isAssignedOnlyRole } from "@/server/tenancy/access";
import { randomToken, sha256 } from "@/server/crypto";
import { getEnv } from "@/lib/env";
import { sendCompanyEmail } from "@/server/services/integration-service";
import { createSignatureProvider } from "@/server/adapters/signatures";
import { createObjectStorage } from "@/server/adapters/storage";
import { formatAddress } from "@/lib/format";
import { notifyUsers, projectAudienceUserIds } from "@/server/services/notification-service";

export type ReportSnapshot = {
  project: {
    id: string;
    name: string;
    number: string;
    status: string;
    address: string;
    customer: string | null;
    customerNotes: string;
    description: string;
  };
  photos: Array<{
    id: string;
    filename: string;
    category: string;
    capturedAt: string | null;
  }>;
  checklists: Array<{ name: string; done: number; total: number }>;
  activity: Array<{ description: string; at: string }>;
};

const PUBLIC_TIMELINE = new Set([
  "project.created",
  "project.started",
  "project.completed",
  "media.uploaded",
  "checklist.completed",
]);

export async function ensureReportTemplates(companyId: string) {
  const existing = await prisma.reportTemplate.findFirst({ where: { companyId, key: "job_summary" } });
  if (existing) return existing;
  return prisma.reportTemplate.create({
    data: {
      companyId,
      key: "job_summary",
      name: "Job summary",
      sections: {
        create: [
          { key: "summary", title: "Job summary", sortOrder: 10 },
          { key: "photos", title: "Site photos", sortOrder: 20 },
          { key: "notes", title: "Customer notes", sortOrder: 30 },
          { key: "activity", title: "Activity", sortOrder: 40 },
        ],
      },
    },
  });
}

async function buildSnapshot(companyId: string, projectId: string): Promise<ReportSnapshot> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId, deletedAt: null },
    include: {
      customer: true,
      projectStatus: true,
      media: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 40,
        include: { tags: { include: { tag: true } } },
      },
      checklists: { where: { deletedAt: null }, include: { items: true } },
      timelineEvents: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!project) throw new AppError(404, "Not found.");
  return {
    project: {
      id: project.id,
      name: project.name,
      number: project.number,
      status: project.projectStatus.name,
      address: formatAddress(project),
      customer: project.customer?.name ?? null,
      customerNotes: project.customerNotes,
      description: project.description,
    },
    photos: project.media.map((item) => ({
      id: item.id,
      filename: item.originalFilename,
      category: item.tags[0]?.tag.name ?? "Photo",
      capturedAt: item.capturedAt?.toISOString() ?? null,
    })),
    checklists: project.checklists.map((list) => ({
      name: list.name,
      done: list.items.filter((row) => row.isComplete).length,
      total: list.items.length,
    })),
    activity: project.timelineEvents
      .filter((event) => PUBLIC_TIMELINE.has(event.type))
      .map((event) => ({ description: event.description, at: event.createdAt.toISOString() })),
  };
}

function parseBody(raw: string): ReportSnapshot | null {
  try {
    return JSON.parse(raw) as ReportSnapshot;
  } catch {
    return null;
  }
}

async function loadOwnedReport(ctx: AuthContext, id: string) {
  requirePermission(ctx, "reports.view");
  const report = await prisma.report.findFirst({
    where: { id, companyId: ctx.company.id, deletedAt: null },
    include: {
      project: { select: { id: true, name: true, number: true } },
      template: true,
      signatures: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!report) throw new AppError(404, "Not found.");
  if (report.projectId) await loadScopedProject(ctx, report.projectId);
  return report;
}

export async function listReports(ctx: AuthContext, projectId?: string) {
  requirePermission(ctx, "reports.view");
  if (projectId) await loadScopedProject(ctx, projectId);
  return prisma.report.findMany({
    where: {
      companyId: ctx.company.id,
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
      ...(isAssignedOnlyRole(ctx) && !projectId ? { project: projectScopeWhere(ctx) } : {}),
    },
    include: {
      project: { select: { id: true, name: true, number: true } },
      signatures: { select: { id: true, status: true, signerName: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

export async function getReport(ctx: AuthContext, id: string) {
  return loadOwnedReport(ctx, id);
}

export async function createReport(ctx: AuthContext, input: unknown) {
  requirePermission(ctx, "reports.create");
  const data = z
    .object({
      projectId: z.string().min(1),
      title: z.string().trim().max(160).optional(),
    })
    .parse(input);
  const project = await loadScopedProject(ctx, data.projectId);
  const template = await ensureReportTemplates(ctx.company.id);
  const snapshot = await buildSnapshot(ctx.company.id, project.id);
  const report = await prisma.report.create({
    data: {
      companyId: ctx.company.id,
      projectId: project.id,
      templateId: template.id,
      title: data.title?.trim() || `${project.number} job report`,
      status: "generated",
      body: JSON.stringify(snapshot),
      generatedAt: new Date(),
    },
    include: { project: { select: { id: true, name: true, number: true } }, signatures: true },
  });
  await recordTimeline({
    companyId: ctx.company.id,
    projectId: project.id,
    actorUserId: ctx.user.id,
    type: "report.generated",
    description: `${ctx.user.firstName} generated report “${report.title}”`,
    entityType: "report",
    entityId: report.id,
  });
  return report;
}

export async function regenerateReport(ctx: AuthContext, id: string) {
  requirePermission(ctx, "reports.create");
  const report = await loadOwnedReport(ctx, id);
  if (!report.projectId) throw new AppError(400, "Report is not tied to a job.");
  const snapshot = await buildSnapshot(ctx.company.id, report.projectId);
  return prisma.report.update({
    where: { id: report.id },
    data: { body: JSON.stringify(snapshot), generatedAt: new Date(), status: "generated" },
    include: { project: { select: { id: true, name: true, number: true } }, signatures: true },
  });
}

export async function shareReport(ctx: AuthContext, id: string) {
  requirePermission(ctx, "reports.share");
  const report = await loadOwnedReport(ctx, id);
  const token = randomToken(24);
  const updated = await prisma.report.update({
    where: { id: report.id },
    data: { shareTokenHash: sha256(token), status: report.status === "signed" ? "signed" : "shared" },
  });
  const url = `${getEnv().APP_URL}/share/r/${token}`;
  await recordTimeline({
    companyId: ctx.company.id,
    projectId: report.projectId,
    actorUserId: ctx.user.id,
    type: "report.shared",
    description: `${ctx.user.firstName} shared report “${report.title}”`,
    entityType: "report",
    entityId: report.id,
  });
  const audience = report.projectId
    ? await projectAudienceUserIds(ctx.company.id, report.projectId, ctx.user.id)
    : [];
  await notifyUsers({
    companyId: ctx.company.id,
    userIds: audience,
    actorUserId: ctx.user.id,
    type: "project.message",
    title: "Report shared",
    body: report.title,
    entityType: "report",
    entityId: report.id,
    projectId: report.projectId,
  });
  await writeAuditLog({
    action: "report.shared",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "report",
    entityId: report.id,
  });
  return { id: updated.id, url, token };
}

export async function requestSignature(
  ctx: AuthContext,
  reportId: string,
  input: unknown,
  meta: { ip?: string | null; userAgent?: string | null },
) {
  requirePermission(ctx, "reports.share");
  const data = z
    .object({
      signerName: z.string().trim().min(1).max(120),
      signerEmail: z.string().trim().email(),
    })
    .parse(input);
  const report = await loadOwnedReport(ctx, reportId);
  const shared = await shareReport(ctx, report.id);
  const provider = createSignatureProvider();
  const { providerRef } = await provider.requestSignature({
    signerName: data.signerName,
    signerEmail: data.signerEmail,
    documentRef: report.id,
  });
  const signature = await prisma.signature.create({
    data: {
      companyId: ctx.company.id,
      projectId: report.projectId,
      reportId: report.id,
      requestedById: ctx.user.id,
      signerName: data.signerName,
      signerEmail: data.signerEmail.toLowerCase(),
      provider: provider.name,
      providerRef,
    },
  });
  await sendCompanyEmail(ctx.company.id, {
    to: data.signerEmail,
    subject: `Signature requested: ${report.title}`,
    text: `Please review and sign:\n${shared.url}`,
  });
  await recordTimeline({
    companyId: ctx.company.id,
    projectId: report.projectId,
    actorUserId: ctx.user.id,
    type: "signature.requested",
    description: `Signature requested from ${data.signerName}`,
    entityType: "signature",
    entityId: signature.id,
  });
  return { signature, shareUrl: shared.url };
}

export async function getPublicReport(token: string) {
  const report = await prisma.report.findFirst({
    where: { shareTokenHash: sha256(token), deletedAt: null },
    include: {
      signatures: { where: { status: "signed" }, orderBy: { signedAt: "desc" } },
      project: { select: { name: true, number: true } },
    },
  });
  if (!report) throw new AppError(404, "Not found.");
  const snapshot = parseBody(report.body);
  if (!snapshot) throw new AppError(404, "Report is empty.");
  return {
    id: report.id,
    title: report.title,
    status: report.status,
    generatedAt: report.generatedAt,
    snapshot,
    signatures: report.signatures.map((row) => ({
      id: row.id,
      signerName: row.signerName,
      signedAt: row.signedAt,
    })),
  };
}

export async function loadSharedReportMedia(token: string, mediaId: string) {
  const report = await prisma.report.findFirst({
    where: { shareTokenHash: sha256(token), deletedAt: null },
  });
  if (!report) throw new AppError(404, "Not found.");
  const snapshot = parseBody(report.body);
  if (!snapshot?.photos.some((photo) => photo.id === mediaId)) throw new AppError(404, "Not found.");
  const media = await prisma.media.findFirst({
    where: { id: mediaId, companyId: report.companyId, deletedAt: null },
  });
  if (!media) throw new AppError(404, "Not found.");
  const storage = createObjectStorage();
  const key = media.thumbnailKey || media.storageKey;
  const body = await storage.get(key);
  return { body, mimeType: "image/jpeg", filename: media.originalFilename };
}

export async function signPublicReport(
  token: string,
  input: unknown,
  meta: { ip?: string | null; userAgent?: string | null },
) {
  const data = z
    .object({
      signerName: z.string().trim().min(1).max(120),
      imageDataUrl: z.string().min(20).max(800_000),
    })
    .parse(input);
  const report = await prisma.report.findFirst({
    where: { shareTokenHash: sha256(token), deletedAt: null },
  });
  if (!report) throw new AppError(404, "Not found.");
  const match = data.imageDataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new AppError(400, "Signature image must be a PNG.");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 40 || bytes.length > 400_000) throw new AppError(400, "Invalid signature image.");
  const storage = createObjectStorage();
  const signatureKey = `${report.companyId}/signatures/${report.id}/${randomToken(12)}.png`;
  await storage.put({ key: signatureKey, body: bytes, contentType: "image/png" });
  const pending = await prisma.signature.findFirst({
    where: { reportId: report.id, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  const signature = pending
    ? await prisma.signature.update({
        where: { id: pending.id },
        data: {
          status: "signed",
          signedAt: new Date(),
          signatureKey,
          signerName: data.signerName,
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        },
      })
    : await prisma.signature.create({
        data: {
          companyId: report.companyId,
          projectId: report.projectId,
          reportId: report.id,
          signerName: data.signerName,
          signerEmail: "shared-link@unsigned.local",
          status: "signed",
          signedAt: new Date(),
          signatureKey,
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
          provider: "internal",
        },
      });
  await prisma.report.update({ where: { id: report.id }, data: { status: "signed" } });
  await recordTimeline({
    companyId: report.companyId,
    projectId: report.projectId,
    type: "signature.collected",
    description: `${data.signerName} signed “${report.title}”`,
    entityType: "signature",
    entityId: signature.id,
  });
  return { ok: true, signedAt: signature.signedAt };
}
