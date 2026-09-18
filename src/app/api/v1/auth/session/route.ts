import { handleApi } from "@/server/api";
import { json } from "@/server/http";
import { serializeAuth } from "@/server/auth/context";

export async function GET(request: Request) {
  return handleApi(request, async ({ ctx }) => {
    if (!ctx) return json({ data: null }, 401);
    return json({ data: serializeAuth(ctx) });
  });
}
