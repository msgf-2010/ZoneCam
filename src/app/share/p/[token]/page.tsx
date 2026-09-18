import { notFound } from "next/navigation";
import { getPublicPayment } from "@/server/services/payment-service";
import { AppError } from "@/server/http";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PublicPaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let payment;
  try {
    payment = await getPublicPayment(token);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-10">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--brand)]">ZoneCam</div>
      <h1 className="mt-2 text-3xl font-semibold">{payment.description}</h1>
      <p className="mt-2 text-[var(--muted)]">{payment.company}</p>
      {payment.project ? (
        <p className="mt-1 text-sm text-[var(--muted)]">
          {payment.project.number} · {payment.project.name}
        </p>
      ) : null}
      <section className="mt-8 rounded-[12px] border border-[var(--line)] bg-white p-5">
        <p className="text-sm text-[var(--muted)]">Amount due</p>
        <p className="mt-1 text-3xl font-semibold">{formatMoney(payment.amountCents, payment.currency)}</p>
        <p className="mt-4 text-sm">Status: {payment.status}</p>
        {payment.status === "paid" ? (
          <p className="mt-3 text-sm">Thank you. This payment is recorded as received.</p>
        ) : payment.status === "cancelled" ? (
          <p className="mt-3 text-sm">This request was cancelled.</p>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Online card checkout is not connected yet. Please pay the office by the method they arranged. This page
            is the official request from {payment.company}.
          </p>
        )}
      </section>
    </div>
  );
}
