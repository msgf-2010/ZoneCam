"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { sortTrades } from "@/lib/trades";
import { formatWalkthroughClock } from "@/lib/walkthrough";

type ChecklistItemRow = {
  id: string;
  title: string;
  isComplete: boolean;
  trade?: string;
  notes?: string;
  timestampMs?: number | null;
  screenshotUrl?: string | null;
};

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
    <form onSubmit={onSubmit}>
      <Field label="Title" error={error ?? undefined}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Photograph north elevation" />
      </Field>
      <Field label="Details">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Assignee">
          <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due">
          <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </Field>
        <Field label="Priority">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
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
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              filter === key
                ? "bg-[var(--brand-subtle)] text-[var(--brand)]"
                : "text-[var(--muted)] hover:bg-[#fafafa]"
            }`}
          >
            {key === "open" ? "Active" : key === "completed" ? "Done" : "All"}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No tasks in this view.</p>
      ) : (
        <ul>
          {visible.map((task) => (
            <li key={task.id} className="flex flex-col gap-2 border-b border-[var(--line)] py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
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
                <Button variant="secondary" onClick={() => complete(task.id)}>
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
    source?: string;
    summary?: string;
    sourceMediaUrl?: string | null;
    items: ChecklistItemRow[];
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
          <div className="min-w-48">
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
            </Select>
          </div>
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
          const hasTrade = list.items.some((item) => item.trade?.trim());
          const grouped = hasTrade
            ? sortTrades([...new Set(list.items.map((item) => item.trade?.trim() || "General"))]).map((trade) => ({
                trade,
                items: list.items.filter((item) => (item.trade?.trim() || "General") === trade),
              }))
            : [{ trade: null as string | null, items: list.items }];
          return (
            <div key={list.id} className="rounded-2xl border border-[var(--line)] bg-[#fafafa] p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-medium">
                  {list.name}
                  {list.source === "walkthrough" ? (
                    <span className="ml-2 rounded-full bg-[#eef6f4] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">Walkthrough</span>
                  ) : null}
                </h3>
                <span className="text-sm text-[var(--muted)]">
                  {done}/{list.items.length}
                </span>
              </div>
              {list.summary ? <p className="mb-3 text-sm text-[var(--muted)]">{list.summary}</p> : null}
              {list.sourceMediaUrl ? (
                <a href={list.sourceMediaUrl} className="mb-3 inline-block text-sm font-medium underline" target="_blank" rel="noreferrer">
                  Play walkthrough video
                </a>
              ) : null}
              {grouped.map((group) => (
                <div key={group.trade ?? "all"} className="mb-3 last:mb-0">
                  {group.trade ? <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{group.trade}</h4> : null}
                  <ul className="space-y-2">
                    {group.items.map((item) => (
                      <li key={item.id} className="rounded-xl bg-white p-2">
                        <label className="flex min-h-12 cursor-pointer items-start gap-3 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1 h-5 w-5"
                            checked={item.isComplete}
                            disabled={!canComplete}
                            onChange={(e) => toggle(item.id, e.target.checked)}
                          />
                          {item.screenshotUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.screenshotUrl}
                              alt=""
                              className="h-14 w-14 shrink-0 rounded-lg object-cover"
                            />
                          ) : null}
                          <span>
                            <span className={item.isComplete ? "text-[var(--muted)] line-through" : ""}>{item.title}</span>
                            {item.timestampMs != null ? (
                              <span className="mt-1 block text-xs text-[var(--muted)]">{formatWalkthroughClock(item.timestampMs)}</span>
                            ) : null}
                            {item.notes ? <span className="mt-1 block text-xs text-[var(--muted)]">{item.notes}</span> : null}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
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
