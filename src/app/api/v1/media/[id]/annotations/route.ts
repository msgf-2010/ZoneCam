import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { saveAnnotations } from "@/server/services/media-service";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson(req);
      return json({ data: await saveAnnotations(ctx, id, body) });
    },
    { auth: true },
  );
}
