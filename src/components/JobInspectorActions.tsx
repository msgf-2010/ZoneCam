"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function JobInspectorActions({
  projectId,
  canSummarize,
  canChecklist,
}: {
  projectId: string;
  canSummarize: boolean;
  canChecklist: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(path: string, ok: string) {
    setPending(true);
    setMessage(null);
    const res = await fetch(path, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    setMessage(res.ok ? ok : json.error ?? "Inspector could not run.");
    if (res.ok) router.refresh();
  }

  if (!canSummarize && !canChecklist) {
    return <p className="text-sm text-[var(--muted)]">You can view inspector notes, but not run them.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        This uses ZoneCam’s local inspector (photo stats and job records). A hosted model is not connected.
      </p>
      <div className="flex flex-wrap gap-2">
        {canSummarize ? (
          <Button disabled={pending} onClick={() => void run(`/api/v1/projects/${projectId}/ai/summary`, "Summary saved as an internal note.")}>
            Summarize job
          </Button>
        ) : null}
        {canChecklist ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => void run(`/api/v1/projects/${projectId}/ai/checklist`, "Inspector checklist added.")}
          >
            Suggest checklist
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
