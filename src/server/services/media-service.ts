import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/http";
import { writeAuditLog } from "@/server/audit";
import { recordTimeline } from "@/server/timeline";
import { notifyUsers, projectAudienceUserIds } from "@/server/services/notification-service";
import { loadScopedProject } from "@/server/tenancy/access";
import { createObjectStorage, signedMediaPath } from "@/server/adapters/storage";
import { getJobQueue } from "@/server/adapters/jobs";
import { getEnv } from "@/lib/env";
import { mediaKindFromMime } from "@/server/media/types";
import { registerMediaJobs } from "@/server/media/processor";
import { registerAiJobs } from "@/server/services/ai-service";
import { isSmallJpegThumb, makeJpegThumbnail, smallThumbKey } from "@/server/media/thumbnail";
import { randomToken } from "@/server/crypto";

registerMediaJobs();
registerAiJobs();

const PAGE_SIZE = 40;

function toDto(media: {
  id: string;
  type: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  description: string;
  capturedAt: Date | null;
  createdAt: Date;
  latitude: number | null;
  longitude: number | null;
  processingStatus: string;
  uploadStatus: string;
  folderId: string | null;
  tags?: Array<{ tag: { id: string; name: string } }>;
}) {
  return {
    id: media.id,
    type: media.type,
    originalFilename: media.originalFilename,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    width: media.width,
    height: media.height,
    durationMs: media.durationMs,
    description: media.description,
    capturedAt: media.capturedAt,
    uploadedAt: media.createdAt,
    latitude: media.latitude,
    longitude: media.longitude,
    processingStatus: media.processingStatus,
    uploadStatus: media.uploadStatus,
    folderId: media.folderId,
    tags: media.tags?.map((t) => t.tag) ?? [],
    urls: {
      original: signedMediaPath(media.id, "original"),
      thumbnail: signedMediaPath(media.id, "thumbnail"),
    },
  };
}

export async function listProjectMedia(
  ctx: AuthContext,
  projectId: string,
  filters: { cursor?: string; q?: string; type?: string; folderId?: string; tag?: string } = {},
) {
  requirePermission(ctx, "media.view");
  await loadScopedProject(ctx, projectId);
  const items = await prisma.media.findMany({
    where: {
      companyId: ctx.company.id,
      projectId,
      deletedAt: null,
      ...(filters.type ? { type: filters.type as "photo" | "video" | "file" } : {}),
      ...(filters.folderId ? { folderId: filters.folderId } : {}),
      ...(filters.q ? { originalFilename: { contains: filters.q } } : {}),
      ...(filters.tag ? { tags: { some: { tag: { name: filters.tag, companyId: ctx.company.id } } } } : {}),
      ...(filters.cursor ? { id: { lt: filters.cursor } } : {}),
    },
    include: { tags: { include: { tag: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
  });
  const hasMore = items.length > PAGE_SIZE;
  const page = hasMore ? items.slice(0, PAGE_SIZE) : items;
  return {
    items: page.map(toDto),
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
  };
}

export async function countProjectMediaByTag(ctx: AuthContext, projectId: string, tag: string) {
  requirePermission(ctx, "media.view");
  await loadScopedProject(ctx, projectId);
  return prisma.media.count({
    where: {
      companyId: ctx.company.id,
      projectId,
      deletedAt: null,
      tags: { some: { tag: { name: tag, companyId: ctx.company.id } } },
    },
  });
}

export async function getMedia(ctx: AuthContext, id: string) {
  requirePermission(ctx, "media.view");
  const media = await prisma.media.findFirst({
    where: { id, companyId: ctx.company.id, deletedAt: null },
    include: {
      tags: { include: { tag: true } },
      annotations: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!media) throw new AppError(404, "Not found.");
  if (media.projectId) await loadScopedProject(ctx, media.projectId);
  return {
    ...toDto(media),
    annotations: media.annotations.map((a) => ({
      id: a.id,
      payload: JSON.parse(a.payload || "{}"),
      createdAt: a.createdAt,
    })),
  };
}

type IncomingFile = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  capturedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  clientUploadId?: string | null;
  deviceInfo?: string | null;
  description?: string | null;
  category?: string | null;
};

export async function uploadProjectMedia(
  ctx: AuthContext,
  projectId: string,
  files: IncomingFile[],
  meta: { ip?: string | null },
) {
  requirePermission(ctx, "media.upload");
  await loadScopedProject(ctx, projectId);
  if (files.length === 0) throw new AppError(400, "No files uploaded.");
  const maxBytes = getEnv().MEDIA_MAX_BYTES;
  const storage = createObjectStorage();
  const created = [];

  for (const file of files) {
    const kind = mediaKindFromMime(file.mimeType);
    if (!kind) throw new AppError(400, `Unsupported file type: ${file.mimeType}`);
    if (file.buffer.length === 0) throw new AppError(400, "Empty file.");
    if (file.buffer.length > maxBytes) {
      throw new AppError(400, `File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
    }
    const clientUploadId = file.clientUploadId?.trim() || null;
    if (clientUploadId) {
      const existing = await prisma.media.findFirst({
        where: { companyId: ctx.company.id, clientUploadId, deletedAt: null },
      });
      if (existing) {
        created.push(existing);
        continue;
      }
    }

    const objectId = randomToken(18);
    const storageKey = `${ctx.company.id}/${projectId}/${objectId}/${file.filename.replace(/[^\w.\-]+/g, "_")}`;
    await storage.put({ key: storageKey, body: file.buffer, contentType: file.mimeType });

    const row = await prisma.media.create({
      data: {
        companyId: ctx.company.id,
        projectId,
        type: kind,
        originalFilename: file.filename.slice(0, 180),
        mimeType: file.mimeType,
        sizeBytes: file.buffer.length,
        storageKey,
        capturedAt: file.capturedAt ? new Date(file.capturedAt) : new Date(),
        latitude: file.latitude ?? null,
        longitude: file.longitude ?? null,
        uploadedById: ctx.user.id,
        clientUploadId,
        uploadStatus: "stored",
        processingStatus: "pending",
        deviceInfo: file.deviceInfo ?? null,
        description: file.description?.trim() ?? "",
      },
    });
    if (kind === "photo") {
      try {
        const thumb = await makeJpegThumbnail(file.buffer);
        const thumbKey = smallThumbKey(storageKey);
        await storage.put({ key: thumbKey, body: thumb, contentType: "image/jpeg" });
        await prisma.media.update({
          where: { id: row.id },
          data: { thumbnailKey: thumbKey, previewKey: thumbKey, processingStatus: "ready" },
        });
        row.thumbnailKey = thumbKey;
        row.previewKey = thumbKey;
        row.processingStatus = "ready";
      } catch {
        /* the original still displays if a thumbnail cannot be made */
      }
    }
    created.push(row);
    if (file.category?.trim()) {
      const tag = await prisma.mediaTag.upsert({
        where: { companyId_name: { companyId: ctx.company.id, name: file.category.trim() } },
        update: {},
        create: { companyId: ctx.company.id, name: file.category.trim() },
      });
      await prisma.mediaTagOnMedia.upsert({
        where: { mediaId_tagId: { mediaId: row.id, tagId: tag.id } },
        update: {},
        create: { mediaId: row.id, tagId: tag.id },
      });
    }
    await getJobQueue().enqueue("media.process", { mediaId: row.id });
  }

  const photos = created.filter((m) => m.type === "photo").length;
  const videos = created.filter((m) => m.type === "video").length;
  const parts = [
    photos ? `${photos} photo${photos === 1 ? "" : "s"}` : null,
    videos ? `${videos} video${videos === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  await recordTimeline({
    companyId: ctx.company.id,
    projectId,
    actorUserId: ctx.user.id,
    type: "media.uploaded",
    description: `${ctx.user.firstName} uploaded ${parts.join(" and ")}`,
    entityType: "media",
    entityId: created[0]?.id,
    metadata: { mediaIds: created.map((m) => m.id), count: created.length },
  });
  await writeAuditLog({
    action: "media.upload",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "project",
    entityId: projectId,
    ipAddress: meta.ip,
    metadata: { count: created.length },
  });
  const audience = await projectAudienceUserIds(ctx.company.id, projectId, ctx.user.id);
  await notifyUsers({
    companyId: ctx.company.id,
    userIds: audience,
    actorUserId: ctx.user.id,
    type: "media.uploaded",
    title: `${ctx.user.firstName} uploaded ${parts.join(" and ")}`,
    body: "New media is on the job.",
    entityType: "project",
    entityId: projectId,
    projectId,
  });
  return created.map((row) => toDto({ ...row, tags: [] }));
}

export async function deleteMedia(ctx: AuthContext, id: string, meta: { ip?: string | null }) {
  requirePermission(ctx, "media.delete");
  const media = await prisma.media.findFirst({
    where: { id, companyId: ctx.company.id, deletedAt: null },
  });
  if (!media) throw new AppError(404, "Not found.");
  if (media.projectId) await loadScopedProject(ctx, media.projectId);
  await prisma.media.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAuditLog({
    action: "media.delete",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "media",
    entityId: id,
    ipAddress: meta.ip,
  });
  if (media.projectId) {
    await recordTimeline({
      companyId: ctx.company.id,
      projectId: media.projectId,
      actorUserId: ctx.user.id,
      type: "media.deleted",
      description: `${ctx.user.firstName} deleted ${media.originalFilename}`,
      entityType: "media",
      entityId: id,
    });
  }
}

export async function updateMediaMeta(ctx: AuthContext, id: string, input: { description?: string; folderId?: string | null }) {
  requirePermission(ctx, "media.upload");
  const media = await prisma.media.findFirst({ where: { id, companyId: ctx.company.id, deletedAt: null } });
  if (!media) throw new AppError(404, "Not found.");
  if (media.projectId) await loadScopedProject(ctx, media.projectId);
  return prisma.media.update({
    where: { id },
    data: {
      description: input.description ?? undefined,
      folderId: input.folderId === undefined ? undefined : input.folderId,
    },
  });
}

export async function tagMedia(ctx: AuthContext, id: string, names: string[]) {
  requirePermission(ctx, "media.upload");
  const media = await prisma.media.findFirst({ where: { id, companyId: ctx.company.id, deletedAt: null } });
  if (!media) throw new AppError(404, "Not found.");
  const tags = [];
  for (const name of names.map((n) => n.trim()).filter(Boolean)) {
    const tag = await prisma.mediaTag.upsert({
      where: { companyId_name: { companyId: ctx.company.id, name } },
      update: {},
      create: { companyId: ctx.company.id, name },
    });
    await prisma.mediaTagOnMedia.upsert({
      where: { mediaId_tagId: { mediaId: id, tagId: tag.id } },
      update: {},
      create: { mediaId: id, tagId: tag.id },
    });
    tags.push(tag);
  }
  return tags;
}

export async function listFolders(ctx: AuthContext, projectId: string) {
  requirePermission(ctx, "media.view");
  await loadScopedProject(ctx, projectId);
  return prisma.mediaFolder.findMany({
    where: { companyId: ctx.company.id, projectId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createFolder(ctx: AuthContext, projectId: string, name: string) {
  requirePermission(ctx, "media.upload");
  await loadScopedProject(ctx, projectId);
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, "Folder name is required.");
  return prisma.mediaFolder.create({
    data: { companyId: ctx.company.id, projectId, name: trimmed.slice(0, 80) },
  });
}

export async function saveAnnotations(ctx: AuthContext, mediaId: string, payload: unknown) {
  requirePermission(ctx, "media.annotate");
  const media = await prisma.media.findFirst({ where: { id: mediaId, companyId: ctx.company.id, deletedAt: null } });
  if (!media) throw new AppError(404, "Not found.");
  if (media.projectId) await loadScopedProject(ctx, media.projectId);
  const annotation = await prisma.mediaAnnotation.create({
    data: {
      companyId: ctx.company.id,
      mediaId,
      createdById: ctx.user.id,
      payload: JSON.stringify(payload ?? {}),
    },
  });
  if (media.projectId) {
    await recordTimeline({
      companyId: ctx.company.id,
      projectId: media.projectId,
      actorUserId: ctx.user.id,
      type: "media.annotated",
      description: `${ctx.user.firstName} annotated a photo`,
      entityType: "media",
      entityId: mediaId,
    });
  }
  return { id: annotation.id, payload, createdAt: annotation.createdAt };
}

export async function loadMediaBytes(ctx: AuthContext | null, mediaId: string, variant: "original" | "thumbnail" | "preview", signed?: { exp: number; sig: string }) {
  if (!ctx) {
    const { verifyMediaAccess } = await import("@/server/adapters/storage");
    if (!signed || !verifyMediaAccess(mediaId, variant, signed.exp, signed.sig)) {
      throw new AppError(401, "Not authenticated.");
    }
  }

  const media = await prisma.media.findFirst({
    where: { id: mediaId, deletedAt: null, ...(ctx ? { companyId: ctx.company.id } : {}) },
  });
  if (!media) throw new AppError(404, "Not found.");

  if (ctx) {
    requirePermission(ctx, "media.view");
    if (media.projectId) await loadScopedProject(ctx, media.projectId);
  }

  const storage = createObjectStorage();
  if (variant === "original") {
    const body = await storage.get(media.storageKey);
    return { body, mimeType: media.mimeType, filename: media.originalFilename };
  }

  const existingThumbKey = isSmallJpegThumb(media.thumbnailKey)
    ? media.thumbnailKey
    : isSmallJpegThumb(media.previewKey)
      ? media.previewKey
      : null;
  if (existingThumbKey) {
    const body = await storage.get(existingThumbKey);
    return { body, mimeType: "image/jpeg", filename: media.originalFilename };
  }

  const original = await storage.get(media.storageKey);
  try {
    const body = await makeJpegThumbnail(original);
    const thumbKey = smallThumbKey(media.storageKey);
    await storage.put({ key: thumbKey, body, contentType: "image/jpeg" });
    await prisma.media.update({
      where: { id: media.id },
      data: { thumbnailKey: thumbKey, previewKey: thumbKey },
    });
    return { body, mimeType: "image/jpeg", filename: media.originalFilename };
  } catch {
    return { body: original, mimeType: media.mimeType, filename: media.originalFilename };
  }
}
