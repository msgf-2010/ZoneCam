import { handleApi } from "@/server/api";
import { json, AppError } from "@/server/http";
import { listProjectTimeline } from "@/server/services/timeline-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const search = new URL(req.url).searchParams;
      return json({
        data: await listProjectTimeline(ctx, id, {
          cursor: search.get("cursor"),
          take: search.get("take") ? Number(search.get("take")) : 40,
        }),
      });
    },
    { auth: true },
  );
}
