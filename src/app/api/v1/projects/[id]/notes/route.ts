import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { addProjectNote } from "@/server/services/project-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson<{ body?: string; visibility?: "internal" | "customer" }>(req);
      return json({ data: await addProjectNote(ctx, id, body.body ?? "", body.visibility) }, 201);
    },
    { auth: true },
  );
}
