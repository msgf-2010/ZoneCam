import { handleApi } from "@/server/api";
import { rateLimit, clientIp } from "@/server/http";
import { loadMediaBytes } from "@/server/services/media-service";
import { safeDownloadFilename } from "@/lib/safe-path";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(request, async ({ ctx, request: req }) => {
    rateLimit(`media:${clientIp(req) ?? "unknown"}`, 180, 60_000);
    const url = new URL(req.url);
    const variant = (url.searchParams.get("variant") as "original" | "thumbnail" | "preview") || "original";
    const exp = Number(url.searchParams.get("exp") ?? 0);
    const sig = url.searchParams.get("sig") ?? "";
    const file = await loadMediaBytes(ctx, id, variant, exp && sig ? { exp, sig } : undefined);
    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${safeDownloadFilename(file.filename)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": variant === "original" ? "private, max-age=60" : "private, max-age=86400",
      },
    });
  });
}
