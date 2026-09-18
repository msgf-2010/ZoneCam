import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { createPayment, listPayments } from "@/server/services/payment-service";

export async function GET(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const projectId = new URL(req.url).searchParams.get("projectId") ?? undefined;
      return json({ data: await listPayments(ctx, projectId) });
    },
    { auth: true },
  );
}

export async function POST(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await createPayment(ctx, await readJson(req)) }, 201);
    },
    { auth: true },
  );
}
