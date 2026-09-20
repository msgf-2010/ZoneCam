"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  entityType: string | null;
  entityId: string | null;
};

function hrefFor(item: Note) {
  if (item.entityType === "project" && item.entityId) return `/projects/${item.entityId}`;
  if (item.entityType === "task" && item.entityId) return `/tasks/${item.entityId}`;
  return "/messages";
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Note[]>([]);

  async function refresh() {
    const res = await fetch("/api/v1/notifications");
    if (!res.ok) return;
    const json = await res.json();
    setCount(json.data?.unreadCount ?? 0);
    setItems(json.data?.items ?? []);
  }

  useEffect(() => {
    void refresh();
    const poll = setInterval(() => void refresh(), 15000);
    const source = new EventSource("/api/v1/realtime/stream");
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type?: string };
        if (data.type && data.type !== "ping" && data.type !== "hello") {
          void refresh();
          router.refresh();
        }
      } catch {
        /* ignore malformed frames */
      }
    };
    return () => {
      clearInterval(poll);
      source.close();
    };
  }, [router]);

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-full p-2 text-sm font-semibold hover:bg-black/5"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        Inbox
        {count > 0 ? (
          <span className="absolute right-0 top-0 inline-flex min-w-4 rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-[var(--line)] bg-white p-2">
          <div className="mb-2 flex justify-between px-2 py-1 text-sm">
            <span className="font-bold text-[var(--ink)]">Notifications</span>
            <button
              type="button"
              className="text-[var(--muted)] hover:text-[var(--brand)]"
              onClick={async () => {
                await fetch("/api/v1/notifications/read-all", { method: "POST" });
                void refresh();
              }}
            >
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-sm text-[var(--muted)]">Nothing yet.</p>
          ) : (
            <ul className="max-h-80 overflow-auto">
              {items.slice(0, 12).map((item) => (
                <li key={item.id}>
                  <Link
                    href={hrefFor(item)}
                    className={`block rounded-xl px-2 py-2 text-sm ${item.readAt ? "text-[var(--muted)]" : "bg-[var(--brand-subtle)]"}`}
                    onClick={async () => {
                      await fetch(`/api/v1/notifications/${item.id}/read`, { method: "POST" });
                      setOpen(false);
                    }}
                  >
                    <div className="font-semibold text-[var(--ink)]">{item.title}</div>
                    <div className="line-clamp-2">{item.body}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
