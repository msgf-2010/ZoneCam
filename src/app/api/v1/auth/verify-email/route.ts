import { handleApi } from "@/server/api";
import { json, readJson } from "@/server/http";
import { verifyEmail } from "@/server/services/auth-service";

export async function POST(request: Request) {
  return handleApi(request, async ({ request: req }) => {
    const body = await readJson<{ token?: string }>(req);
    await verifyEmail(body.token ?? "");
    return json({ ok: true });
  });
}
