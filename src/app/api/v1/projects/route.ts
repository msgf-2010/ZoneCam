import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { createProject, listFieldJobs, listProjects } from "@/server/services/project-service";

export async function GET(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const params = new URL(req.url).searchParams;
      if (params.get("field") === "1") {
        return json({ data: await listFieldJobs(ctx) });
      }
      return json({
        data: await listProjects(ctx, {
          q: params.get("q") ?? undefined,
          statusKey: params.get("status") ?? undefined,
          today: params.get("today") === "1",
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
      return json({ data: await createProject(ctx, body, { ip }) }, 201);
    },
    { auth: true },
  );
}
