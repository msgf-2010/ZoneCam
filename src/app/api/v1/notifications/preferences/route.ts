import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { listNotificationPreferences, upsertNotificationPreference } from "@/server/services/notification-service";

export async function GET(request: Request) {
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await listNotificationPreferences(ctx) });
    },
    { auth: true },
  );
}

export async function PATCH(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson<{ eventType?: string; inApp?: boolean; email?: boolean }>(req);
      return json({
        data: await upsertNotificationPreference(ctx, body.eventType ?? "", {
          inApp: body.inApp,
          email: body.email,
        }),
      });
    },
    { auth: true },
  );
}
