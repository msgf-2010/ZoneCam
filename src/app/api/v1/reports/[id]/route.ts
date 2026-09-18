import { handleApi } from "@/server/api";
import { json, AppError } from "@/server/http";
import { getReport } from "@/server/services/report-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await getReport(ctx, id) });
    },
    { auth: true },
  );
}
