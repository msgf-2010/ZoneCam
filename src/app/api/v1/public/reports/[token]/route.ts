import { handleApi } from "@/server/api";
import { json, rateLimit, clientIp } from "@/server/http";
import { getPublicReport } from "@/server/services/report-service";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  return handleApi(request, async ({ request: req }) => {
    rateLimit(`public-report:${clientIp(req) ?? "unknown"}`, 60, 60_000);
    return json({ data: await getPublicReport(token) });
  });
}
