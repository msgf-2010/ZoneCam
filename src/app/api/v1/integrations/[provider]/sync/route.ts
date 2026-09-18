import { handleApi } from "@/server/api";
import { json, AppError } from "@/server/http";
import { syncIntegration } from "@/server/services/integration-service";

type Params = { params: Promise<{ provider: string }> };

export async function POST(request: Request, { params }: Params) {
  const { provider } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await syncIntegration(ctx, provider) });
    },
    { auth: true },
  );
}
