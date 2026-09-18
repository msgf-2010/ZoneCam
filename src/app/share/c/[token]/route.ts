import { handleApi } from "@/server/api";
import { rateLimit, clientIp } from "@/server/http";
import { getPublicCalendarIcs } from "@/server/services/integration-service";
import { safeDownloadFilename } from "@/lib/safe-path";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  return handleApi(request, async ({ request: req }) => {
    rateLimit(`public-cal:${clientIp(req) ?? "unknown"}`, 30, 60_000);
    const { ics, filename } = await getPublicCalendarIcs(token);
    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeDownloadFilename(filename)}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}

export async function HEAD(request: Request, ctx: Params) {
  return GET(request, ctx);
}
