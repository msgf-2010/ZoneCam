"use client";

import { useState } from "react";

export function NotificationPrefs({
  initial,
}: {
  initial: Array<{ eventType: string; label: string; inApp: boolean; email: boolean }>;
}) {
  const [rows, setRows] = useState(initial);

  async function toggle(eventType: string, field: "inApp" | "email", value: boolean) {
    setRows((current) => current.map((row) => (row.eventType === eventType ? { ...row, [field]: value } : row)));
    await fetch("/api/v1/notifications/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, [field]: value }),
    });
  }

  return (
    <div className="space-y-3 text-sm">
      {rows.map((row) => (
        <div key={row.eventType} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] py-3 last:border-0">
          <span>{row.label}</span>
          <label className="flex items-center gap-4">
            <span>
              <input type="checkbox" checked={row.inApp} onChange={(e) => void toggle(row.eventType, "inApp", e.target.checked)} /> In-app
            </span>
            <span>
              <input type="checkbox" checked={row.email} onChange={(e) => void toggle(row.eventType, "email", e.target.checked)} /> Email
            </span>
          </label>
        </div>
      ))}
    </div>
  );
}
