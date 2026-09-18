"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FieldNewJob({ userId, compact }: { userId: string; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!compact);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        addressLine1: address || null,
        startDate: today,
        projectStatusKey: "in_progress",
        memberIds: [userId],
      }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(json.error ?? "Could not create job.");
      return;
    }
    const id = json.data?.id;
    if (id) router.push(`/field/${id}`);
    else router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="field-add-job" onClick={() => setOpen(true)}>
        + Add a job
      </button>
    );
  }

  return (
    <form className="field-new" onSubmit={onSubmit}>
      <div className="field-new-head">
        <div>
          <div className="field-job-kicker">New site</div>
          <p className="field-lead">Name the job, then start shooting.</p>
        </div>
        {compact ? (
          <button type="button" className="field-ghost" onClick={() => setOpen(false)}>
            Close
          </button>
        ) : null}
      </div>
      <label className="field-label">Job name</label>
      <input className="field-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="123 Oak roof" />
      <label className="field-label">Address</label>
      <input className="field-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" />
      {error ? <p className="field-status">{error}</p> : null}
      <button type="submit" className="field-primary field-primary-full" disabled={pending || !name.trim()}>
        {pending ? "Creating…" : "Start this job"}
      </button>
    </form>
  );
}
