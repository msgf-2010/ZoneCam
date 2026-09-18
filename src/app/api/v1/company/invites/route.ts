import { handleApi } from "@/server/api";
import { json, readJson, AppError } from "@/server/http";
import { inviteMember } from "@/server/services/company-service";

export async function POST(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson(req);
      return json({ data: await inviteMember(ctx, body, { ip }) }, 201);
    },
    { auth: true },
  );
}
