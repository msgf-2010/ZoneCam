import { handleApi } from "@/server/api";
import { json, rateLimit, readJson, clientIp } from "@/server/http";
import { login } from "@/server/services/auth-service";

export async function POST(request: Request) {
  return handleApi(request, async ({ request: req }) => {
    const ip = clientIp(req) ?? "unknown";
    rateLimit(`login:${ip}`, 12, 15 * 60 * 1000);
    const body = await readJson<{ email?: string }>(req);
    rateLimit(`login-email:${(body.email ?? "unknown").toLowerCase()}`, 12, 15 * 60 * 1000);
    const session = await login(body, {
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    return json({ data: session });
  });
}
