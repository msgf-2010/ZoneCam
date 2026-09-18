import { handleApi } from "@/server/api";
import { json, readJson, AppError } from "@/server/http";
import { getCompanyOverview, updateCompany } from "@/server/services/company-service";

export async function GET(request: Request) {
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      return json({ data: await getCompanyOverview(ctx) });
    },
    { auth: true },
  );
}

export async function PATCH(request: Request) {
  return handleApi(
    request,
    async ({ ctx, request: req, ip }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      const body = await readJson(req);
      const company = await updateCompany(ctx, body, { ip });
      return json({ data: { id: company.id, name: company.name, timezone: company.timezone, slug: company.slug } });
    },
    { auth: true },
  );
}
