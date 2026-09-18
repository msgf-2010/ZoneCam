import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { requestSignature } from "@/server/services/report-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({
        data: await requestSignature(ctx, id, await readJson(req), {
          ip,
          userAgent: req.headers.get("user-agent"),
        }),
      }, 201);
    },
    { auth: true },
  );
}
