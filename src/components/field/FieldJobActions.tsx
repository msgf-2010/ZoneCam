"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FieldJobActions({
  projectId,
  statusKey,
  canRun,
  directions,
}: {
  projectId: string;
  statusKey: string;
  canRun: boolean;
  directions: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const terminal = statusKey === "completed" || statusKey === "cancelled";

  async function post(path: string) {
    setPending(true);
    await fetch(path, { method: "POST" });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="field-actions">
      {directions ? (
        <a className="field-secondary" href={directions} target="_blank" rel="noreferrer">
          Navigate
        </a>
      ) : null}
      {canRun && !terminal && statusKey !== "in_progress" ? (
        <button type="button" className="field-primary" disabled={pending} onClick={() => post(`/api/v1/projects/${projectId}/start`)}>
          Start job
        </button>
      ) : null}
      {canRun && !terminal ? (
        <button type="button" className="field-ghost" disabled={pending} onClick={() => post(`/api/v1/projects/${projectId}/complete`)}>
          Complete job
        </button>
      ) : null}
    </div>
  );
}
