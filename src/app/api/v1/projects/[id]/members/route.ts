import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { setProjectMembers } from "@/server/services/project-service";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson<{ userIds?: string[] }>(req);
      return json({ data: await setProjectMembers(ctx, id, body.userIds ?? [], { ip }) });
    },
    { auth: true },
  );
}
