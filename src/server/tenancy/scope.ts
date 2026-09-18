import { AppError } from "@/server/http";

/**
 * Every tenant query must pass the authenticated company id — never a client-only id.
 */
export function tenantWhere(companyId: string, extra: Record<string, unknown> = {}) {
  return { companyId, deletedAt: null, ...extra };
}

export function assertSameCompany<T extends { companyId: string | null }>(
  ctx: { company: { id: string } },
  record: T | null,
): T {
  if (!record || record.companyId !== ctx.company.id) {
    throw new AppError(404, "Not found.");
  }
  return record;
}
