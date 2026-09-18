import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { deleteMedia, getMedia, updateMediaMeta } from "@/server/services/media-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await getMedia(ctx, id) });
    },
    { auth: true },
  );
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson<{ description?: string; folderId?: string | null }>(req);
      return json({ data: await updateMediaMeta(ctx, id, body) });
    },
    { auth: true },
  );
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      await deleteMedia(ctx, id, { ip });
      return json({ ok: true });
    },
    { auth: true },
  );
}
