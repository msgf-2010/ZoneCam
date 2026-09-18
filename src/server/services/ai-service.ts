import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/http";
import { loadScopedProject } from "@/server/tenancy/access";
import { createObjectStorage } from "@/server/adapters/storage";
import { createAiService } from "@/server/adapters/ai";
import { getJobQueue } from "@/server/adapters/jobs";
import { recordTimeline } from "@/server/timeline";
import { addProjectNote } from "@/server/services/project-service";
import { createProjectChecklist } from "@/server/services/checklist-service";

const INSPECTOR_PREFIX = "Inspector:";

let registered = false;

export function registerAiJobs() {
  if (registered) return;
  registered = true;
  getJobQueue().register<{ mediaId: string }>("ai.analyze-media", async ({ mediaId }) => {
    await analyzeStoredMedia(mediaId);
  });
}

export async function analyzeStoredMedia(mediaId: string, force = false) {
  const media = await prisma.media.findFirst({
    where: { id: mediaId, deletedAt: null },
    include: { tags: { include: { tag: true } } },
  });
  if (!media || media.type !== "photo") return null;
  if (!force && media.description && !media.description.startsWith(INSPECTOR_PREFIX)) return media;
  try {
    const ai = createAiService();
    const storage = createObjectStorage();
    const buffer = await storage.get(media.storageKey);
    const description = await ai.generatePhotoDescription({
      mimeType: media.mimeType,
      buffer,
      filename: media.originalFilename,
      tags: media.tags.map((row) => row.tag.name),
      hasGps: media.latitude != null && media.longitude != null,
    });
    return prisma.media.update({
      where: { id: media.id },
      data: { description },
    });
  } catch (error) {
    if (force) throw error;
    return media;
  }
}

export async function analyzeMedia(ctx: AuthContext, mediaId: string) {
  requirePermission(ctx, "media.annotate");
  const media = await prisma.media.findFirst({
    where: { id: mediaId, companyId: ctx.company.id, deletedAt: null },
  });
  if (!media) throw new AppError(404, "Not found.");
  if (media.projectId) await loadScopedProject(ctx, media.projectId);
  try {
    const updated = await analyzeStoredMedia(media.id, true);
    if (!updated) throw new AppError(400, "Only photos can be inspected.");
    return updated;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, error instanceof Error ? error.message : "AI is not connected.");
  }
}

export async function summarizeProject(ctx: AuthContext, projectId: string) {
  requirePermission(ctx, "projects.edit");
  const project = await loadScopedProject(ctx, projectId);
  const [notes, mediaCount, checklists, status] = await Promise.all([
    prisma.projectNote.findMany({
      where: { projectId, companyId: ctx.company.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.media.count({ where: { projectId, companyId: ctx.company.id, deletedAt: null } }),
    prisma.checklist.findMany({
      where: { projectId, companyId: ctx.company.id, deletedAt: null },
      include: { items: true },
    }),
    prisma.projectStatus.findFirst({ where: { id: project.projectStatusId } }),
  ]);
  const done = checklists.reduce((sum, list) => sum + list.items.filter((item) => item.isComplete).length, 0);
  const total = checklists.reduce((sum, list) => sum + list.items.length, 0);
  const ai = createAiService();
  let body: string;
  try {
    body = await ai.generateProjectSummary({
      name: project.name,
      number: project.number,
      status: status?.name,
      notes: notes.map((note) => note.body),
      photoCount: mediaCount,
      checklistDone: done,
      checklistTotal: total,
    });
  } catch (error) {
    throw new AppError(400, error instanceof Error ? error.message : "AI is not connected.");
  }
  const note = await addProjectNote(ctx, projectId, body, "internal");
  await recordTimeline({
    companyId: ctx.company.id,
    projectId,
    actorUserId: ctx.user.id,
    type: "ai.summary",
    description: `${ctx.user.firstName} ran the job inspector`,
    entityType: "project",
    entityId: projectId,
  });
  return note;
}

export async function suggestProjectChecklist(ctx: AuthContext, projectId: string) {
  requirePermission(ctx, "tasks.create");
  const project = await loadScopedProject(ctx, projectId);
  const type = await prisma.projectType.findFirst({ where: { id: project.projectTypeId ?? "" } });
  const ai = createAiService();
  let items: string[];
  try {
    items = await ai.generateChecklist({ jobType: type?.name ?? "service" });
  } catch (error) {
    throw new AppError(400, error instanceof Error ? error.message : "AI is not connected.");
  }
  return createProjectChecklist(ctx, projectId, {
    name: `Inspector · ${type?.name ?? "Job"}`,
    items,
  });
}
