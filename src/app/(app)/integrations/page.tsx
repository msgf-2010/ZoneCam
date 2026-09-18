import { requireAuth } from "@/server/auth/context";
import { listIntegrations, getIntegration } from "@/server/services/integration-service";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ProjectRow";
import { IntegrationActions } from "@/components/IntegrationActions";
import { AppError } from "@/server/http";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const ctx = await requireAuth();
  if (!ctx.permissions.has("integrations.view")) {
    return <p>You do not have permission to view integrations.</p>;
  }
  let items;
  try {
    items = await listIntegrations(ctx);
  } catch (error) {
    if (error instanceof AppError) return <p>{error.message}</p>;
    throw error;
  }
  const canManage = ctx.permissions.has("integrations.manage");
  const email = items.find((item) => item.provider === "email" && item.status === "connected");
  const calendar = items.find((item) => item.provider === "calendar" && item.status === "connected");
  const [emailDetail, calendarDetail] = await Promise.all([
    email ? getIntegration(ctx, "email") : Promise.resolve(null),
    calendar ? getIntegration(ctx, "calendar") : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect what is actually available. Vendor apps stay marked coming later until a real adapter exists."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <Card key={item.provider} title={item.name}>
            <IntegrationActions item={item} canManage={canManage} />
          </Card>
        ))}
      </div>
      {emailDetail?.logs.length ? (
        <Card title="Email log">
          <ul className="divide-y divide-[var(--line)] text-sm">
            {emailDetail.logs.map((log) => (
              <li key={log.id} className="py-2">
                <div>{log.message}</div>
                <div className="text-[var(--muted)]">
                  {log.level} · {new Date(log.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {calendarDetail?.logs.length ? (
        <Card title="Calendar log">
          <ul className="divide-y divide-[var(--line)] text-sm">
            {calendarDetail.logs.map((log) => (
              <li key={log.id} className="py-2">
                <div>{log.message}</div>
                <div className="text-[var(--muted)]">
                  {log.level} · {new Date(log.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
