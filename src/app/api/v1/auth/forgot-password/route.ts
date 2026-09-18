import { handleApi } from "@/server/api";
import { json, readJson, rateLimit, clientIp } from "@/server/http";
import { requestPasswordReset } from "@/server/services/auth-service";

export async function POST(request: Request) {
  return handleApi(request, async ({ request: req }) => {
    rateLimit(`forgot:${clientIp(req) ?? "unknown"}`, 8, 15 * 60 * 1000);
    const body = (await readJson<{ email?: string }>(req)) ?? {};
    if (body.email) await requestPasswordReset(body.email);
    return json({ ok: true });
  });
}
