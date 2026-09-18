import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

type AuditInput = {
  action: string;
  companyId?: string | null;
  userId?: string | null;
  entityType?: string;
  entityId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditInput, client: Prisma.TransactionClient | typeof prisma = prisma) {
  await client.auditLog.create({
    data: {
      action: input.action,
      companyId: input.companyId ?? null,
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: JSON.stringify(input.metadata ?? {}),
    },
  });
}
