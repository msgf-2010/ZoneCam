import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { setChecklistItemComplete } from "@/server/services/checklist-service";

type Params = { params: Promise<{ itemId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { itemId } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson<{ isComplete?: boolean }>(req);
      return json({ data: await setChecklistItemComplete(ctx, itemId, Boolean(body.isComplete)) });
    },
    { auth: true },
  );
}
