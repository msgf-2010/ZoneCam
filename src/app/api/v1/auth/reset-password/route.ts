import { handleApi } from "@/server/api";
import { json, readJson, rateLimit, clientIp } from "@/server/http";
import { resetPassword } from "@/server/services/auth-service";

export async function POST(request: Request) {
  return handleApi(request, async ({ request: req }) => {
    rateLimit(`reset:${clientIp(req) ?? "unknown"}`, 8, 15 * 60 * 1000);
    const body = await readJson<{ token?: string; password?: string }>(req);
    await resetPassword(body.token ?? "", body.password ?? "");
    return json({ ok: true });
  });
}
