import { handleApi } from "@/server/api";
import { loadSharedReportMedia } from "@/server/services/report-service";

type Params = { params: Promise<{ token: string; mediaId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { token, mediaId } = await params;
  return handleApi(request, async () => {
    const file = await loadSharedReportMedia(token, mediaId);
    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=120",
      },
    });
  });
}
