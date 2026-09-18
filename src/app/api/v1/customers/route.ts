import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { createCustomer, listCustomers } from "@/server/services/customer-service";

export async function GET(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const q = new URL(req.url).searchParams.get("q") ?? undefined;
      return json({ data: await listCustomers(ctx, q) });
    },
    { auth: true },
  );
}

export async function POST(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson(req);
      return json({ data: await createCustomer(ctx, body, { ip }) }, 201);
    },
    { auth: true },
  );
}
