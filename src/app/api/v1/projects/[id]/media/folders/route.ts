import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { createFolder, listFolders } from "@/server/services/media-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await listFolders(ctx, id) });
    },
    { auth: true },
  );
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson<{ name?: string }>(req);
      return json({ data: await createFolder(ctx, id, body.name ?? "") }, 201);
    },
    { auth: true },
  );
}
