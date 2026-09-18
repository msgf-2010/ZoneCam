import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { updateChecklistTemplate } from "@/server/services/checklist-service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await updateChecklistTemplate(ctx, id, await readJson(req)) });
    },
    { auth: true },
  );
}
