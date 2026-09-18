import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { tagMedia } from "@/server/services/media-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson<{ names?: string[] }>(req);
      return json({ data: await tagMedia(ctx, id, body.names ?? []) });
    },
    { auth: true },
  );
}
