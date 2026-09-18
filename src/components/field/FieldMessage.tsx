"use client";

import { useEffect, useMemo, useState } from "react";

type Message = {
  id: string;
  body: string;
  createdAt: string;
  authorId?: string | null;
  author?: { firstName: string; lastName: string } | null;
};

export function FieldMessage({
  projectId,
  currentUserId,
  initial,
}: {
  projectId: string;
  currentUserId: string;
  initial: Message[];
}) {
  const [body, setBody] = useState("");
  const [rows, setRows] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const snapshot = useMemo(() => initial.map((row) => row.id).join(","), [initial]);

  useEffect(() => {
    setRows(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, snapshot]);

  useEffect(() => {
    setBody("");
    setStatus(null);
  }, [projectId]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refresh();
    }, 12000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function refresh() {
    const res = await fetch(`/api/v1/projects/${projectId}/comments`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(json.data)) return;
    setRows(
      json.data.map((row: Message & { createdAt: string }) => ({
        ...row,
        createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date(row.createdAt).toISOString(),
      })),
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    const res = await fetch(`/api/v1/projects/${projectId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setStatus(json.error ?? "Could not send.");
      return;
    }
    setRows((current) => [...current, json.data]);
    setBody("");
    setStatus("Sent.");
  }

  return (
    <section className="field-thread">
      <h2 className="field-sub">Job messages</h2>
      <ul className="field-msg-list">
        {rows.length === 0 ? <li className="field-empty">No messages yet. The office will see anything you send here.</li> : null}
        {rows.map((row) => {
          const mine = row.authorId === currentUserId;
          return (
            <li key={row.id} className={mine ? "field-msg field-msg-me" : "field-msg field-msg-them"}>
              <div className="field-msg-who">{mine ? "You" : row.author ? `${row.author.firstName} ${row.author.lastName}` : "Office"}</div>
              <p className="field-msg-body">{row.body}</p>
              <div className="field-msg-time">{new Date(row.createdAt).toLocaleString()}</div>
            </li>
          );
        })}
      </ul>
      <form className="field-stack" onSubmit={send}>
        <textarea
          className="field-note"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Need material, access, or a decision?"
        />
        <button type="submit" className="field-secondary field-primary-full" disabled={pending || !body.trim()}>
          {pending ? "Sending…" : "Send to office"}
        </button>
        {status ? <p className="field-status">{status}</p> : null}
      </form>
    </section>
  );
}
