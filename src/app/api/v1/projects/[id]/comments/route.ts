import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { listProjectMessages, postProjectMessage } from "@/server/services/message-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await listProjectMessages(ctx, id) });
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
      return json({ data: await postProjectMessage(ctx, id, await readJson(req)) }, 201);
    },
    { auth: true },
  );
}
