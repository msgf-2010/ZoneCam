import { handleApi } from "@/server/api";
import { json, AppError } from "@/server/http";
import { markNotificationRead } from "@/server/services/notification-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await markNotificationRead(ctx, id) });
    },
    { auth: true },
  );
}
