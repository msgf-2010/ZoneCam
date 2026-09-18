import { handleApi } from "@/server/api";
import { AppError } from "@/server/http";
import { loadMediaBytes } from "@/server/services/media-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const file = await loadMediaBytes(ctx, id, "original");
      return new Response(new Uint8Array(file.body), {
        headers: {
          "Content-Type": file.mimeType,
          "Content-Disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"`,
        },
      });
    },
    { auth: true },
  );
}
