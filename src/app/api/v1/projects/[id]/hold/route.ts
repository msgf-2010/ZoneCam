import { handleApi } from "@/server/api";
import { json, AppError } from "@/server/http";
import { transitionProject } from "@/server/services/project-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await transitionProject(ctx, id, "hold", { ip }) });
    },
    { auth: true },
  );
}
