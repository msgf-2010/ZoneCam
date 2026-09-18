import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import {
  applyChecklistTemplate,
  createProjectChecklist,
  listProjectChecklists,
} from "@/server/services/checklist-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await listProjectChecklists(ctx, id) });
    },
    { auth: true },
  );
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson<{ templateId?: string; name?: string; items?: string[] }>(req);
      if (body.templateId) {
        return json({ data: await applyChecklistTemplate(ctx, id, body.templateId) }, 201);
      }
      return json({ data: await createProjectChecklist(ctx, id, body) }, 201);
    },
    { auth: true },
  );
}
