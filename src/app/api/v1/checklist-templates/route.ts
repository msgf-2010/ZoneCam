import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { createChecklistTemplate, listChecklistTemplates } from "@/server/services/checklist-service";

export async function GET(request: Request) {
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await listChecklistTemplates(ctx) });
    },
    { auth: true },
  );
}

export async function POST(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await createChecklistTemplate(ctx, await readJson(req)) }, 201);
    },
    { auth: true },
  );
}
