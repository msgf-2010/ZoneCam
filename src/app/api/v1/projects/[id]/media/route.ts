import { handleApi } from "@/server/api";
import { json, AppError } from "@/server/http";
import { listProjectMedia, uploadProjectMedia } from "@/server/services/media-service";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const q = new URL(req.url).searchParams;
      return json({
        data: await listProjectMedia(ctx, id, {
          cursor: q.get("cursor") ?? undefined,
          q: q.get("q") ?? undefined,
          type: q.get("type") ?? undefined,
          folderId: q.get("folderId") ?? undefined,
          tag: q.get("tag") ?? undefined,
        }),
      });
    },
    { auth: true },
  );
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const form = await req.formData();
      const blobs = form.getAll("files").filter((item): item is File => item instanceof File);
      const metaRaw = form.get("metadata");
      const metadata = typeof metaRaw === "string" ? (JSON.parse(metaRaw) as Array<Record<string, unknown>>) : [];
      const sharedCapture = form.get("capturedAt");
      const sharedLat = form.get("latitude");
      const sharedLng = form.get("longitude");
      const files = await Promise.all(
        blobs.map(async (file, index) => {
          const extra = metadata[index] ?? {};
          return {
            buffer: Buffer.from(await file.arrayBuffer()),
            filename: file.name || `upload-${index}`,
            mimeType: file.type || "application/octet-stream",
            capturedAt: String(extra.capturedAt ?? sharedCapture ?? "") || null,
            latitude: extra.latitude != null ? Number(extra.latitude) : sharedLat ? Number(sharedLat) : null,
            longitude: extra.longitude != null ? Number(extra.longitude) : sharedLng ? Number(sharedLng) : null,
            clientUploadId: String(extra.clientUploadId ?? form.get("clientUploadId") ?? "") || null,
            deviceInfo: String(extra.deviceInfo ?? form.get("deviceInfo") ?? "") || null,
            description: String(extra.description ?? "") || null,
            category: String(extra.category ?? form.get("category") ?? "") || null,
          };
        }),
      );
      return json({ data: await uploadProjectMedia(ctx, id, files, { ip }) }, 201);
    },
    { auth: true },
  );
}
