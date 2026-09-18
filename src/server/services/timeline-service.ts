import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { loadScopedProject } from "@/server/tenancy/access";
import { AppError } from "@/server/http";

export async function listProjectTimeline(
  ctx: AuthContext,
  projectId: string,
  opts: { cursor?: string | null; take?: number } = {},
) {
  requirePermission(ctx, "projects.view");
  await loadScopedProject(ctx, projectId);
  const take = Math.min(Math.max(opts.take ?? 40, 1), 80);
  const cursor = opts.cursor
    ? await prisma.timelineEvent.findFirst({
        where: { id: opts.cursor, companyId: ctx.company.id, projectId },
      })
    : null;
  if (opts.cursor && !cursor) throw new AppError(400, "Invalid timeline cursor.");

  const rows = await prisma.timelineEvent.findMany({
    where: {
      companyId: ctx.company.id,
      projectId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    include: { actor: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return {
    items: items.map((event) => ({
      ...event,
      metadata: safeJson(event.metadata),
    })),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}
