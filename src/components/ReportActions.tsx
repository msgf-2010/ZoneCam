"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";

export function ReportCreateForm({
  projects,
}: {
  projects: Array<{ id: string; number: string; name: string }>;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/v1/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(json.error ?? "Could not create report.");
      return;
    }
    router.push(`/reports/${json.data.id}`);
  }

  if (projects.length === 0) return <p className="text-sm text-[var(--muted)]">Create a job before generating a report.</p>;

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <Field label="Job">
        <Select className="min-w-56" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((job) => (
            <option key={job.id} value={job.id}>
              {job.number} · {job.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Generating…" : "Generate report"}
      </Button>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </form>
  );
}

export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function generate() {
    await fetch(`/api/v1/reports/${reportId}/generate`, { method: "POST" });
    router.refresh();
  }

  async function share() {
    const res = await fetch(`/api/v1/reports/${reportId}/share`, { method: "POST" });
    const json = await res.json();
    setShareUrl(json.data?.url ?? null);
    setMessage(json.data?.url ? "Share link ready." : json.error);
  }

  async function requestSign(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/v1/reports/${reportId}/signatures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signerName, signerEmail }),
    });
    const json = await res.json();
    if (json.data?.shareUrl) setShareUrl(json.data.shareUrl);
    setMessage(res.ok ? "Signature request sent. The link is also printed in the server log." : json.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void generate()}>
          Refresh from job
        </Button>
        <Button onClick={() => void share()}>Create share link</Button>
      </div>
      {shareUrl ? (
        <p className="break-all text-sm">
          Customer link: <a className="font-medium underline" href={shareUrl}>{shareUrl}</a>
        </p>
      ) : null}
      <form onSubmit={requestSign} className="grid gap-3 sm:grid-cols-2">
        <Field label="Signer name">
          <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
        </Field>
        <Field label="Signer email">
          <Input type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} required />
        </Field>
        <Button type="submit">Request signature</Button>
      </form>
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
