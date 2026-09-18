"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";

export function TaskDetailActions({
  taskId,
  status,
  canComplete,
  canEdit,
}: {
  taskId: string;
  status: string;
  canComplete: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [item, setItem] = useState("");
  const [pending, setPending] = useState(false);

  async function complete() {
    setPending(true);
    await fetch(`/api/v1/tasks/${taskId}/complete`, { method: "POST" });
    setPending(false);
    router.refresh();
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await fetch(`/api/v1/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: comment }),
    });
    setComment("");
    setPending(false);
    router.refresh();
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await fetch(`/api/v1/tasks/${taskId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: item }),
    });
    setItem("");
    setPending(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canComplete && status !== "completed" ? (
        <Button className="min-h-12" disabled={pending} onClick={complete}>
          Mark complete
        </Button>
      ) : null}
      {canEdit ? (
        <form onSubmit={addItem}>
          <Field label="Checklist item on this task">
            <Input value={item} onChange={(e) => setItem(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" disabled={pending || !item.trim()}>
            Add item
          </Button>
        </form>
      ) : null}
      <form onSubmit={addComment}>
        <Field label="Comment">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending || !comment.trim()}>
          Add comment
        </Button>
      </form>
    </div>
  );
}

export function TemplateEditor({
  canCreate,
}: {
  canCreate: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [items, setItems] = useState("Verify equipment\nPhotograph existing damage");
  const [error, setError] = useState<string | null>(null);

  if (!canCreate) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const list = items
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const res = await fetch("/api/v1/checklist-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, items: list }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not save template.");
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[12px] border border-[var(--line)] p-4">
      <Field label="Template name" error={error ?? undefined}>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Items (one per line)">
        <Textarea value={items} onChange={(e) => setItems(e.target.value)} />
      </Field>
      <Button type="submit">Save template</Button>
    </form>
  );
}
