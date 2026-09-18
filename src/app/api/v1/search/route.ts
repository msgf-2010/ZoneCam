import { handleApi } from "@/server/api";
import { json, AppError, rateLimit } from "@/server/http";
import { searchCompany } from "@/server/services/search-service";

export async function GET(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      rateLimit(`search:${ctx.user.id}`, 60, 60_000);
      const q = new URL(req.url).searchParams.get("q") ?? "";
      return json({ data: await searchCompany(ctx, q) });
    },
    { auth: true },
  );
}
