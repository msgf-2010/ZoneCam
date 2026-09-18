import { handleApi } from "@/server/api";
import { json, AppError, rateLimit } from "@/server/http";
import { resendVerification } from "@/server/services/auth-service";

export async function POST(request: Request) {
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      rateLimit(`verify-resend:${ctx.user.id}`, 5, 15 * 60 * 1000);
      await resendVerification(ctx.user.id, ctx.user.email);
      return json({ ok: true });
    },
    { auth: true },
  );
}
