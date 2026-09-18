"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function PaymentCreateForm({
  projects,
}: {
  projects: Array<{ id: string; number: string; name: string }>;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/v1/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, amount, description, payerName, payerEmail }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(json.error ?? "Could not create payment.");
      return;
    }
    router.push(`/payments/${json.data.id}`);
  }

  if (projects.length === 0) return <p className="text-sm text-[var(--muted)]">Create a job before requesting payment.</p>;

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Job">
        <select
          className="w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((job) => (
            <option key={job.id} value={job.id}>
              {job.number} · {job.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Amount (USD)">
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="250.00" required />
      </Field>
      <Field label="Description">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Final invoice" />
      </Field>
      <Field label="Payer name">
        <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} />
      </Field>
      <Field label="Payer email">
        <Input type="email" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={pending || !amount.trim()}>
          {pending ? "Saving…" : "Create request"}
        </Button>
      </div>
      {error ? <p className="text-sm text-[var(--danger)] sm:col-span-2">{error}</p> : null}
    </form>
  );
}

export function PaymentActions({
  paymentId,
  status,
}: {
  paymentId: string;
  status: string;
}) {
  const router = useRouter();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function requestPay() {
    const res = await fetch(`/api/v1/payments/${paymentId}/request`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(json.error ?? "Could not send request.");
      return;
    }
    setShareUrl(json.data?.url ?? null);
    setMessage(json.data?.emailed ? "Request emailed. The link is also in the server log." : "Share link ready. Add a payer email to send it automatically.");
    router.refresh();
  }

  async function markPaid() {
    const res = await fetch(`/api/v1/payments/${paymentId}/paid`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Marked as received." : json.error);
    router.refresh();
  }

  async function cancel() {
    const res = await fetch(`/api/v1/payments/${paymentId}/cancel`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Cancelled." : json.error);
    router.refresh();
  }

  const closed = status === "paid" || status === "cancelled";

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        Card processors such as Stripe are not connected. This is ZoneCam’s internal ledger: send the customer a
        request, then record cash, check, or ACH when it arrives.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void requestPay()} disabled={closed}>
          Send request
        </Button>
        <Button variant="secondary" onClick={() => void markPaid()} disabled={status === "paid" || status === "cancelled"}>
          Mark received
        </Button>
        <Button variant="ghost" onClick={() => void cancel()} disabled={closed}>
          Cancel
        </Button>
      </div>
      {shareUrl ? (
        <p className="break-all text-sm">
          Customer link:{" "}
          <a className="font-medium underline" href={shareUrl}>
            {shareUrl}
          </a>
        </p>
      ) : null}
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
