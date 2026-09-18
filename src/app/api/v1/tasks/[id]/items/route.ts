import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { addTaskItem } from "@/server/services/task-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson<{ title?: string }>(req);
      return json({ data: await addTaskItem(ctx, id, body.title ?? "") }, 201);
    },
    { auth: true },
  );
}
