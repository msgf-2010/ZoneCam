import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { deleteTask, loadVisibleTask, updateTask } from "@/server/services/task-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await loadVisibleTask(ctx, id) });
    },
    { auth: true },
  );
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await updateTask(ctx, id, await readJson(req)) });
    },
    { auth: true },
  );
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await deleteTask(ctx, id) });
    },
    { auth: true },
  );
}
