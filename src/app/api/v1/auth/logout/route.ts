import { handleApi } from "@/server/api";
import { json } from "@/server/http";
import { logout } from "@/server/services/auth-service";

export async function POST(request: Request) {
  return handleApi(request, async ({ ctx, request: req, ip }) => {
    await logout({
      ip,
      userAgent: req.headers.get("user-agent"),
      userId: ctx?.user.id,
      companyId: ctx?.company.id,
      request: req,
    });
    return json({ ok: true });
  });
}
