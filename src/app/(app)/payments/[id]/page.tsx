import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { getPayment } from "@/server/services/payment-service";
import { AppError } from "@/server/http";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ProjectRow";
import { PaymentActions } from "@/components/PaymentActions";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  let payment;
  try {
    payment = await getPayment(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={payment.description}
        description={payment.project ? `${payment.project.number} · ${payment.project.name}` : "Payment"}
        action={
          payment.project ? (
            <Link href={`/projects/${payment.project.id}`} className="text-sm font-medium">
              Open job
            </Link>
          ) : null
        }
      />
      <p className="text-2xl font-semibold">{formatMoney(payment.amountCents, payment.currency)}</p>
      <p className="text-sm text-[var(--muted)]">
        Status: {payment.status}
        {payment.customer ? ` · ${payment.customer.name}` : ""}
        {payment.payerEmail ? ` · ${payment.payerEmail}` : ""}
        {payment.paidAt ? ` · received ${payment.paidAt.toLocaleString()}` : ""}
      </p>
      {ctx.permissions.has("payments.create") ? (
        <Card title="Request & record">
          <PaymentActions paymentId={payment.id} status={payment.status} />
        </Card>
      ) : null}
    </div>
  );
}
