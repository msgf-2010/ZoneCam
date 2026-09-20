"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

type Message = {
  id: string;
  body: string;
  createdAt: string;
  author?: { firstName: string; lastName: string } | null;
};

export function MessageThread({
  projectId,
  initial,
}: {
  projectId: string;
  initial: Message[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [rows, setRows] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snapshot = useMemo(() => initial.map((row) => row.id).join(","), [initial]);

  useEffect(() => {
    setRows(initial);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when the selected job or its message ids change
  }, [projectId, snapshot]);

  useEffect(() => {
    setBody("");
  }, [projectId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch(`/api/v1/projects/${projectId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(json.error ?? "Could not send.");
      return;
    }
    setRows((current) => [...current, json.data]);
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <ul className="max-h-80 space-y-3 overflow-auto">
        {rows.length === 0 ? <li className="text-sm text-[var(--muted)]">No messages on this job yet.</li> : null}
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl bg-[#f5f5f5] p-3 text-sm">
            <div className="font-medium">
              {row.author ? `${row.author.firstName} ${row.author.lastName}` : "Someone"}
            </div>
            <p className="mt-1 whitespace-pre-wrap">{row.body}</p>
            <div className="mt-1 text-xs text-[var(--muted)]">{new Date(row.createdAt).toLocaleString()}</div>
          </li>
        ))}
      </ul>
      <form onSubmit={send}>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message the crew. Mention someone with @First Last"
        />
        {error ? <p className="mt-1 text-sm text-[var(--danger)]">{error}</p> : null}
        <Button className="mt-2" type="submit" disabled={pending || !body.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
