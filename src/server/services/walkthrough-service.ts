import { z } from "zod";
import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/http";
import { recordTimeline } from "@/server/timeline";
import { loadScopedProject } from "@/server/tenancy/access";
import { createAiService } from "@/server/adapters/ai";
import { uploadProjectMedia } from "@/server/services/media-service";
import { addProjectNote } from "@/server/services/project-service";
import { notifyUsers, projectAudienceUserIds } from "@/server/services/notification-service";
import { WALKTHROUGH_MAX_MS, WALKTHROUGH_MAX_SCREENSHOTS, WALKTHROUGH_TAG } from "@/lib/walkthrough";
import { sortTrades } from "@/lib/trades";

const segmentSchema = z.object({
  startMs: z.number().int().min(0).max(WALKTHROUGH_MAX_MS + 60_000),
  endMs: z.number().int().min(0).max(WALKTHROUGH_MAX_MS + 60_000),
  text: z.string().trim().max(500),
  screenshotIndex: z.number().int().min(0).max(WALKTHROUGH_MAX_SCREENSHOTS).nullable().optional(),
});

export const walkthroughTranscriptSchema = z.object({
  text: z.string().trim().max(8000).optional().default(""),
  durationMs: z.number().int().min(0).max(WALKTHROUGH_MAX_MS + 60_000),
  segments: z.array(segmentSchema).max(80).optional().default([]),
});

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

function actorName(ctx: AuthContext) {
  return `${ctx.user.firstName} ${ctx.user.lastName}`.trim();
}

export async function createProjectWalkthrough(
  ctx: AuthContext,
  projectId: string,
  input: {
    video: IncomingFile;
    screenshots: IncomingFile[];
    audio?: IncomingFile | null;
    transcript: unknown;
    deviceInfo?: string | null;
  },
  meta: { ip?: string | null },
) {
  requirePermission(ctx, "media.upload");
  const project = await loadScopedProject(ctx, projectId);
  const transcript = walkthroughTranscriptSchema.parse(input.transcript);
  if (input.screenshots.length > WALKTHROUGH_MAX_SCREENSHOTS) {
    throw new AppError(400, `At most ${WALKTHROUGH_MAX_SCREENSHOTS} screenshots can be attached.`);
  }

  const files: IncomingFile[] = [
    {
      ...input.video,
      category: WALKTHROUGH_TAG,
      description: input.video.description || transcript.text.slice(0, 180) || "Site walkthrough video",
      deviceInfo: input.deviceInfo ?? input.video.deviceInfo ?? null,
    },
    ...input.screenshots.map((file, index) => ({
      ...file,
      category: WALKTHROUGH_TAG,
      description: file.description || `Walkthrough screenshot ${index + 1}`,
      deviceInfo: input.deviceInfo ?? file.deviceInfo ?? null,
    })),
  ];
  if (input.audio) {
    files.push({
      ...input.audio,
      category: WALKTHROUGH_TAG,
      description: input.audio.description || "Walkthrough voice recording",
      deviceInfo: input.deviceInfo ?? input.audio.deviceInfo ?? null,
    });
  }

  const uploaded = await uploadProjectMedia(ctx, projectId, files, meta);
  const video = uploaded.find((item) => item.type === "video") ?? uploaded[0];
  const screenshots = uploaded.filter((item) => item.type === "photo");

  const type = await prisma.projectType.findFirst({ where: { id: project.projectTypeId ?? "" } });
  const ai = createAiService();
  let generated: { summary: string; items: Array<{ title: string; trade: string; notes: string; timestampMs: number; screenshotIndex: number | null }> };
  try {
    generated = await ai.generateWalkthroughChecklist({
      jobName: project.name,
      jobType: type?.name,
      durationMs: transcript.durationMs,
      transcript: transcript.text,
      segments: transcript.segments,
      screenshotCount: screenshots.length,
    });
  } catch {
    generated = {
      summary: "Walkthrough video saved.",
      items: [],
    };
  }

  const checklist = await prisma.checklist.create({
    data: {
      companyId: ctx.company.id,
      projectId,
      name: `Walkthrough · ${new Date().toLocaleDateString()}`,
      source: "walkthrough",
      summary: generated.summary,
      sourceMediaId: video?.id ?? null,
      items: {
        create: generated.items.map((item, sortOrder) => ({
          companyId: ctx.company.id,
          title: item.title.slice(0, 200),
          sortOrder,
          trade: item.trade.slice(0, 40),
          notes: item.notes.slice(0, 1000),
          timestampMs: Math.round(item.timestampMs),
          screenshotMediaId:
            item.screenshotIndex != null && screenshots[item.screenshotIndex]
              ? screenshots[item.screenshotIndex].id
              : null,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  await addProjectNote(ctx, projectId, generated.summary, "internal");
  await recordTimeline({
    companyId: ctx.company.id,
    projectId,
    actorUserId: ctx.user.id,
    type: "walkthrough.created",
    description: `${actorName(ctx)} sent a walkthrough checklist`,
    entityType: "checklist",
    entityId: checklist.id,
    metadata: { mediaId: video?.id, itemCount: checklist.items.length },
  });

  const trades = sortTrades([...new Set(checklist.items.map((item) => item.trade).filter(Boolean))]);
  const audience = await projectAudienceUserIds(ctx.company.id, projectId, ctx.user.id);
  await notifyUsers({
    companyId: ctx.company.id,
    userIds: audience,
    actorUserId: ctx.user.id,
    type: "walkthrough.ready",
    title: `${ctx.user.firstName} sent a walkthrough checklist`,
    body: trades.length ? `${checklist.items.length} items · ${trades.join(", ")}` : generated.summary.slice(0, 180),
    entityType: "checklist",
    entityId: checklist.id,
    projectId,
  });

  return {
    checklist,
    summary: generated.summary,
    videoId: video?.id ?? null,
    screenshotIds: screenshots.map((item) => item.id),
    trades,
  };
}
