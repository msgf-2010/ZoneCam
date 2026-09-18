"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";

export type TaskRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueAt: string | null;
  projectId: string | null;
  project?: { id: string; name: string; number: string } | null;
  assignee?: { firstName: string; lastName: string } | null;
  items: Array<{ id: string; title: string; isComplete: boolean }>;
};

export function TaskCreateForm({
  projectId,
  members,
  canCreate,
}: {
  projectId?: string;
  members: Array<{ id: string; firstName: string; lastName: string }>;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState("normal");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canCreate) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        projectId: projectId || null,
        assigneeId: assigneeId || null,
        dueAt: dueAt || null,
        priority,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(json.error ?? "Could not create task.");
      return;
    }
    setTitle("");
    setDescription("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[12px] border border-[var(--line)] p-4">
      <Field label="New task" error={error ?? undefined}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Photograph north elevation" />
      </Field>
      <Field label="Details">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Assignee">
          <select
            className="w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due">
          <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </Field>
        <Field label="Priority">
          <select
            className="w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
      </div>
      <Button type="submit" disabled={pending || !title.trim()}>
        Add task
      </Button>
    </form>
  );
}

export function TaskList({
  tasks,
  canComplete,
}: {
  tasks: TaskRow[];
  canComplete: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("open");
  const visible = useMemo(() => {
    if (filter === "all") return tasks;
    if (filter === "open") return tasks.filter((t) => t.status === "open" || t.status === "in_progress");
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  async function complete(id: string) {
    await fetch(`/api/v1/tasks/${id}/complete`, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {["open", "completed", "all"].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === key ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)]"}`}
          >
            {key === "open" ? "Active" : key === "completed" ? "Done" : "All"}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No tasks in this view.</p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {visible.map((task) => (
            <li key={task.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Link href={`/tasks/${task.id}`} className="font-medium">
                  {task.title}
                </Link>
                <div className="text-sm text-[var(--muted)]">
                  {task.project ? `${task.project.number} · ${task.project.name}` : "No job"}
                  {task.assignee ? ` · ${task.assignee.firstName} ${task.assignee.lastName}` : ""}
                  {task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : ""}
                  {` · ${task.priority}`}
                </div>
                {task.items.length > 0 ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {task.items.filter((i) => i.isComplete).length}/{task.items.length} items
                  </p>
                ) : null}
              </div>
              {canComplete && task.status !== "completed" ? (
                <Button variant="secondary" className="min-h-11" onClick={() => complete(task.id)}>
                  Complete
                </Button>
              ) : (
                <span className="text-sm text-[var(--muted)]">{task.status.replace("_", " ")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ChecklistBoard({
  projectId,
  checklists,
  templates,
  canCreate,
  canComplete,
}: {
  projectId: string;
  checklists: Array<{
    id: string;
    name: string;
    items: Array<{ id: string; title: string; isComplete: boolean }>;
  }>;
  templates: Array<{ id: string; name: string }>;
  canCreate: boolean;
  canComplete: boolean;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [pending, setPending] = useState(false);

  async function applyTemplate() {
    if (!templateId) return;
    setPending(true);
    await fetch(`/api/v1/projects/${projectId}/checklists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    setPending(false);
    router.refresh();
  }

  async function toggle(itemId: string, isComplete: boolean) {
    await fetch(`/api/v1/checklist-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isComplete }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canCreate && templates.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <Button variant="secondary" disabled={pending} onClick={applyTemplate}>
            Add checklist
          </Button>
        </div>
      ) : null}
      {checklists.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No checklists on this job yet.</p>
      ) : (
        checklists.map((list) => {
          const done = list.items.filter((i) => i.isComplete).length;
          return (
            <div key={list.id} className="rounded-[12px] border border-[var(--line)] p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-medium">{list.name}</h3>
                <span className="text-sm text-[var(--muted)]">
                  {done}/{list.items.length}
                </span>
              </div>
              <ul className="space-y-2">
                {list.items.map((item) => (
                  <li key={item.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={item.isComplete}
                        disabled={!canComplete}
                        onChange={(e) => toggle(item.id, e.target.checked)}
                      />
                      <span className={item.isComplete ? "text-[var(--muted)] line-through" : ""}>{item.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}

export function TimelineFeed({
  events,
  projectId,
}: {
  projectId: string;
  events: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: Date | string;
    actor?: { firstName: string; lastName: string } | null;
  }>;
}) {
  const [rows, setRows] = useState(events);
  const [cursor, setCursor] = useState<string | null>(events.length >= 40 ? events[events.length - 1]?.id ?? null : null);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    const res = await fetch(`/api/v1/projects/${projectId}/timeline?cursor=${cursor}`);
    const json = await res.json();
    const items = json.data?.items ?? [];
    setRows((current) => [...current, ...items]);
    setCursor(json.data?.nextCursor ?? null);
    setLoading(false);
  }

  return (
    <div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No events yet.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((event) => (
            <li key={event.id} className="border-l-2 border-[var(--line)] pl-3 text-sm">
              <div className="font-medium">{event.description}</div>
              <div className="text-[var(--muted)]">
                {event.actor ? `${event.actor.firstName} ${event.actor.lastName}` : "System"} ·{" "}
                {new Date(event.createdAt).toLocaleString()} · {event.type}
              </div>
            </li>
          ))}
        </ol>
      )}
      {cursor ? (
        <Button className="mt-4" variant="secondary" disabled={loading} onClick={loadMore}>
          {loading ? "Loading…" : "Older activity"}
        </Button>
      ) : null}
    </div>
  );
}
