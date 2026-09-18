import { handleApi } from "@/server/api";
import { json, AppError } from "@/server/http";
import { listMembers } from "@/server/services/company-service";

export async function GET(request: Request) {
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await listMembers(ctx) });
    },
    { auth: true },
  );
}
