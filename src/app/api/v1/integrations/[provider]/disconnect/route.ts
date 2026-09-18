import { handleApi } from "@/server/api";
import { json, AppError } from "@/server/http";
import { disconnectIntegration } from "@/server/services/integration-service";

type Params = { params: Promise<{ provider: string }> };

export async function POST(request: Request, { params }: Params) {
  const { provider } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await disconnectIntegration(ctx, provider) });
    },
    { auth: true },
  );
}
