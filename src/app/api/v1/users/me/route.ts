import { handleApi } from "@/server/api";
import { json, readJson, AppError } from "@/server/http";
import { updateProfile } from "@/server/services/company-service";

export async function GET(request: Request) {
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: ctx.user });
    },
    { auth: true },
  );
}

export async function PATCH(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson(req);
      return json({ data: await updateProfile(ctx, body) });
    },
    { auth: true },
  );
}
