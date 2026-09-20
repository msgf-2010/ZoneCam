"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";

export function JobActions({
  projectId,
  statusKey,
  canEdit,
}: {
  projectId: string;
  statusKey: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const terminal = statusKey === "completed" || statusKey === "cancelled";

  async function post(path: string) {
    setPending(true);
    await fetch(path, { method: "POST" });
    setPending(false);
    router.refresh();
  }

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await fetch(`/api/v1/projects/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: note, visibility: "internal" }),
    });
    setNote("");
    setPending(false);
    router.refresh();
  }

  if (!canEdit) return null;

  return (
    <div className="space-y-4">
      {!terminal ? (
        <div className="flex flex-wrap gap-2">
          {statusKey !== "in_progress" ? (
            <Button disabled={pending} onClick={() => post(`/api/v1/projects/${projectId}/start`)}>
              Start job
            </Button>
          ) : null}
          <Button variant="secondary" disabled={pending} onClick={() => post(`/api/v1/projects/${projectId}/hold`)}>
            On hold
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => post(`/api/v1/projects/${projectId}/complete`)}>
            Complete job
          </Button>
        </div>
      ) : null}
      <form onSubmit={saveNote}>
        <Field label="Add note">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending || !note.trim()}>
          Save note
        </Button>
      </form>
    </div>
  );
}
