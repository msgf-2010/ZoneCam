import { prisma } from "@/server/db";
import { fanoutRealtime } from "@/server/realtime-bus";

export async function recordTimeline(input: {
  companyId: string;
  projectId?: string | null;
  actorUserId?: string | null;
  type: string;
  description: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const event = await prisma.timelineEvent.create({
    data: {
      companyId: input.companyId,
      projectId: input.projectId ?? null,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      description: input.description,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: JSON.stringify(input.metadata ?? {}),
    },
  });
  await fanoutRealtime({
    companyId: input.companyId,
    projectId: input.projectId ?? undefined,
    type: input.type,
    payload: { eventId: event.id, description: input.description },
  });
  return event;
}
