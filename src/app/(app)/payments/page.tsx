import Link from "next/link";
import { requireAuth } from "@/server/auth/context";
import { listPayments } from "@/server/services/payment-service";
import { listProjects } from "@/server/services/project-service";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ProjectRow";
import { PaymentCreateForm } from "@/components/PaymentActions";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const ctx = await requireAuth();
  if (!ctx.permissions.has("payments.view")) {
    return <p>You do not have permission to view payments.</p>;
  }
  const [payments, projects] = await Promise.all([listPayments(ctx), listProjects(ctx)]);
  const canCreate = ctx.permissions.has("payments.create");

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Job payment requests. Card checkout stays unconnected until a processor is configured." />
      {canCreate ? (
        <Card title="New request">
          <PaymentCreateForm projects={projects.map((job) => ({ id: job.id, number: job.number, name: job.name }))} />
        </Card>
      ) : null}
      <Card title="Company payments">
        {payments.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No payment requests yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)] text-sm">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between py-3">
                <Link href={`/payments/${payment.id}`} className="font-medium">
                  {payment.description}
                </Link>
                <span className="text-[var(--muted)]">
                  {formatMoney(payment.amountCents, payment.currency)} · {payment.status}
                  {payment.project ? ` · ${payment.project.number}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
