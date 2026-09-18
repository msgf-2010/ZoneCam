import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { getIntegration, updateIntegrationSettings } from "@/server/services/integration-service";

type Params = { params: Promise<{ provider: string }> };

export async function GET(request: Request, { params }: Params) {
  const { provider } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await getIntegration(ctx, provider) });
    },
    { auth: true },
  );
}

export async function PATCH(request: Request, { params }: Params) {
  const { provider } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await updateIntegrationSettings(ctx, provider, await readJson(req)) });
    },
    { auth: true },
  );
}
