import { handleApi } from "@/server/api";
import { json, AppError } from "@/server/http";
import { listNotifications, unreadCount } from "@/server/services/notification-service";

export async function GET(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const unread = new URL(req.url).searchParams.get("unread") === "1";
      const [items, count] = await Promise.all([listNotifications(ctx, unread), unreadCount(ctx)]);
      return json({ data: { items, unreadCount: count } });
    },
    { auth: true },
  );
}
