import { prisma } from "@/server/db";
import { createObjectStorage } from "@/server/adapters/storage";
import { getJobQueue } from "@/server/adapters/jobs";
import { mp4DurationMs, readImageSize } from "@/server/media/inspect";
import { makeJpegThumbnail, smallThumbKey } from "@/server/media/thumbnail";

let registered = false;

export function registerMediaJobs() {
  if (registered) return;
  registered = true;
  getJobQueue().register<{ mediaId: string }>("media.process", async ({ mediaId }) => {
    await processMedia(mediaId);
  });
}

export async function processMedia(mediaId: string) {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media || media.deletedAt) return;
  await prisma.media.update({
    where: { id: mediaId },
    data: { processingStatus: "processing" },
  });
  const storage = createObjectStorage();
  try {
    const original = await storage.get(media.storageKey);
    const patch: {
      width?: number;
      height?: number;
      durationMs?: number;
      thumbnailKey?: string;
      previewKey?: string;
      processingStatus: "ready";
      processingError: null;
    } = { processingStatus: "ready", processingError: null };

    if (media.type === "photo") {
      const size = readImageSize(original);
      if (size) {
        patch.width = size.width;
        patch.height = size.height;
      }
      const thumbKey = smallThumbKey(media.storageKey);
      const thumb = await makeJpegThumbnail(original);
      await storage.put({ key: thumbKey, body: thumb, contentType: "image/jpeg" });
      patch.thumbnailKey = thumbKey;
      patch.previewKey = thumbKey;
    } else if (media.type === "video") {
      const durationMs = mp4DurationMs(original);
      if (durationMs) patch.durationMs = durationMs;
    }

    await prisma.media.update({ where: { id: mediaId }, data: patch });
    const { aiEnabled } = await import("@/server/adapters/ai");
    if (media.type === "photo" && aiEnabled()) {
      await getJobQueue().enqueue("ai.analyze-media", { mediaId });
    }
  } catch (error) {
    await prisma.media.update({
      where: { id: mediaId },
      data: {
        processingStatus: "failed",
        processingError: error instanceof Error ? error.message : "Processing failed",
      },
    });
  }
}
