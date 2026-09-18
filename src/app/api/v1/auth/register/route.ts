import { handleApi } from "@/server/api";
import { json, rateLimit, readJson, clientIp } from "@/server/http";
import { registerAccount } from "@/server/services/auth-service";

export async function POST(request: Request) {
  return handleApi(request, async ({ request: req }) => {
    const ip = clientIp(req) ?? "unknown";
    rateLimit(`register:${ip}`, 8, 15 * 60 * 1000);
    const body = await readJson(req);
    const session = await registerAccount(body, {
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    return json({ data: session }, 201);
  });
}
