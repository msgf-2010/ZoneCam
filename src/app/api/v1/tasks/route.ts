import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { createTask, listTasks } from "@/server/services/task-service";
import type { TaskStatus } from "@prisma/client";

export async function GET(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const params = new URL(req.url).searchParams;
      const status = params.get("status") as TaskStatus | null;
      return json({
        data: await listTasks(ctx, {
          projectId: params.get("projectId") ?? undefined,
          status: status ?? undefined,
          assigneeId: params.get("assigneeId") ?? undefined,
          q: params.get("q") ?? undefined,
          mine: params.get("mine") === "1",
        }),
      });
    },
    { auth: true },
  );
}

export async function POST(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson(req);
      return json({ data: await createTask(ctx, body, { ip }) }, 201);
    },
    { auth: true },
  );
}
