import { handleApi } from "@/server/api";
import { json, readJson, rateLimit } from "@/server/http";
import { signPublicReport } from "@/server/services/report-service";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  return handleApi(request, async ({ request: req, ip }) => {
    rateLimit(`public-sign:${ip ?? "unknown"}`, 10, 15 * 60 * 1000);
    return json({
      data: await signPublicReport(token, await readJson(req), {
        ip,
        userAgent: req.headers.get("user-agent"),
      }),
    });
  });
}
