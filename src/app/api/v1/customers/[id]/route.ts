import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { deleteCustomer, getCustomer, updateCustomer } from "@/server/services/customer-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await getCustomer(ctx, id) });
    },
    { auth: true },
  );
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson(req);
      return json({ data: await updateCustomer(ctx, id, body, { ip }) });
    },
    { auth: true },
  );
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      await deleteCustomer(ctx, id, { ip });
      return json({ ok: true });
    },
    { auth: true },
  );
}
