import { handleApi } from "@/server/api";
import { json, AppError } from "@/server/http";
import { markAllRead } from "@/server/services/notification-service";

export async function POST(request: Request) {
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await markAllRead(ctx) });
    },
    { auth: true },
  );
}
