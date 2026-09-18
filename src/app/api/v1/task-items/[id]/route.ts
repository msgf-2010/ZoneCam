import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { setTaskItemComplete } from "@/server/services/task-service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson<{ isComplete?: boolean }>(req);
      return json({ data: await setTaskItemComplete(ctx, id, Boolean(body.isComplete)) });
    },
    { auth: true },
  );
}
