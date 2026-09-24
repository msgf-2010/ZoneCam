import { handleApi } from "@/server/api";
import { json, AppError } from "@/server/http";
import { createProjectWalkthrough, walkthroughTranscriptSchema } from "@/server/services/walkthrough-service";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 120;

function asFile(value: FormDataEntryValue | null): File | null {
  if (typeof value === "string" || !value) return null;
  if (value.size <= 0) return null;
  if (value instanceof File) return value;
  const blob = value as Blob;
  const name = "name" in blob && typeof blob.name === "string" ? blob.name : "upload.bin";
  return new File([blob], name, { type: blob.type || "application/octet-stream" });
}

function whole(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normalizeTranscript(value: unknown) {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const segments = Array.isArray(row.segments) ? row.segments : [];
  return {
    text: typeof row.text === "string" ? row.text : "",
    durationMs: whole(row.durationMs),
    segments: segments.map((segment) => {
      const item = segment && typeof segment === "object" ? (segment as Record<string, unknown>) : {};
      const shot = item.screenshotIndex;
      return {
        startMs: whole(item.startMs),
        endMs: whole(item.endMs),
        text: typeof item.text === "string" ? item.text : "",
        screenshotIndex: shot == null || shot === "" ? null : whole(shot),
      };
    }),
  };
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      let form: FormData;
      try {
        form = await req.formData();
      } catch {
        throw new AppError(400, "The video did not arrive complete. Record a shorter clip and send it again.");
      }
      const video = asFile(form.get("video"));
      if (!video) throw new AppError(400, "A walkthrough video is required.");
      const audio = asFile(form.get("audio"));
      const screenshots = form.getAll("screenshots").filter((item): item is File => item instanceof File && item.size > 0);
      const transcriptRaw = form.get("transcript");
      let transcriptJson: unknown = { text: "", durationMs: 0, segments: [] };
      if (typeof transcriptRaw === "string" && transcriptRaw.trim()) {
        try {
          transcriptJson = JSON.parse(transcriptRaw);
        } catch {
          throw new AppError(400, "Walkthrough transcript was not valid JSON.");
        }
      }
      const transcript = walkthroughTranscriptSchema.parse(normalizeTranscript(transcriptJson));
      const capturedAt = String(form.get("capturedAt") ?? "") || new Date().toISOString();
      const deviceInfo = String(form.get("deviceInfo") ?? "") || null;
      const clientStamp = Date.now();

      const toIncoming = async (file: File, filename: string, description: string | null) => ({
        buffer: Buffer.from(await file.arrayBuffer()),
        filename,
        mimeType: file.type || "application/octet-stream",
        capturedAt,
        clientUploadId: `${id}-walkthrough-${filename}-${file.size}-${clientStamp}-${Math.random().toString(36).slice(2)}`,
        deviceInfo,
        description,
        category: "Walkthrough",
      });

      return json(
        {
          data: await createProjectWalkthrough(
            ctx,
            id,
            {
              video: await toIncoming(video, video.name || "walkthrough.webm", transcript.text.slice(0, 180) || "Site walkthrough"),
              screenshots: await Promise.all(
                screenshots.map((file, index) =>
                  toIncoming(file, file.name || `walkthrough-frame-${String(index + 1).padStart(2, "0")}.jpg`, `Walkthrough screenshot ${index + 1}`),
                ),
              ),
              audio: audio ? await toIncoming(audio, audio.name || "walkthrough-voice.webm", "Walkthrough voice recording") : null,
              transcript,
              deviceInfo,
            },
            { ip },
          ),
        },
        201,
      );
    },
    { auth: true },
  );
}
