import { handleApi } from "@/server/api";
import { json, AppError } from "@/server/http";
import { createProjectWalkthrough, walkthroughTranscriptSchema } from "@/server/services/walkthrough-service";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 120;

function asFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const form = await req.formData();
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
      const transcript = walkthroughTranscriptSchema.parse(transcriptJson);
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
