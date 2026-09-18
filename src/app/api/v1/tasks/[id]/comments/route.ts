import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { addTaskComment, listTaskComments } from "@/server/services/task-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await listTaskComments(ctx, id) });
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
      const body = await readJson<{ body?: string }>(req);
      return json({ data: await addTaskComment(ctx, id, body.body ?? "") }, 201);
    },
    { auth: true },
  );
}
