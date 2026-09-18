import { handleApi } from "@/server/api";
import { json, AppError } from "@/server/http";
import { analyzeMedia } from "@/server/services/ai-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await analyzeMedia(ctx, id) });
    },
    { auth: true },
  );
}
