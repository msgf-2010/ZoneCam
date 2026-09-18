import { handleApi } from "@/server/api";
import { json, AppError, readJson } from "@/server/http";
import { addCustomerContact } from "@/server/services/customer-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return handleApi(
    request,
    async ({ ctx, request: req, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson(req);
      return json({ data: await addCustomerContact(ctx, id, body, { ip }) }, 201);
    },
    { auth: true },
  );
}
