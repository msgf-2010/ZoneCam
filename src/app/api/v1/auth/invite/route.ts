import { handleApi } from "@/server/api";
import { json, readJson, rateLimit } from "@/server/http";
import { acceptInvite } from "@/server/services/company-service";

export async function POST(request: Request) {
  return handleApi(request, async ({ request: req, ip }) => {
    const body = await readJson(req);
    rateLimit(`invite:${ip ?? "unknown"}`, 8, 15 * 60 * 1000);
    await acceptInvite(body, { ip, userAgent: req.headers.get("user-agent") });
    return json({ ok: true });
  });
}
