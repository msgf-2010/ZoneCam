"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/EmptyState";

type IntegrationCardData = {
  provider: string;
  name: string;
  description: string;
  available: boolean;
  status: string;
};

function tone(status: string, available: boolean): "ok" | "warn" | "bad" | "neutral" {
  if (status === "connected") return "ok";
  if (status === "error") return "bad";
  if (!available) return "neutral";
  if (status === "disconnected") return "warn";
  return "neutral";
}

function label(status: string, available: boolean) {
  if (!available) return "Coming later";
  if (status === "connected") return "Connected";
  if (status === "disconnected") return "Disconnected";
  if (status === "error") return "Error";
  return "Not configured";
}

export function IntegrationActions({
  item,
  canManage,
}: {
  item: IntegrationCardData;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);

  async function post(path: string) {
    setPending(true);
    setMessage(null);
    const res = await fetch(path, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setMessage(json.error ?? "Request failed.");
      return;
    }
    if (json.data?.feedUrl) setFeedUrl(json.data.feedUrl);
    setMessage(json.data?.message ?? (path.endsWith("/connect") ? "Connected." : path.endsWith("/disconnect") ? "Disconnected." : "Synced."));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">{item.description}</p>
      <StatusChip tone={tone(item.status, item.available)}>{label(item.status, item.available)}</StatusChip>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          {item.available && item.status !== "connected" ? (
            <Button disabled={pending} onClick={() => void post(`/api/v1/integrations/${item.provider}/connect`)}>
              Connect
            </Button>
          ) : null}
          {item.available && item.status === "connected" ? (
            <>
              <Button disabled={pending} onClick={() => void post(`/api/v1/integrations/${item.provider}/sync`)}>
                Sync
              </Button>
              <Button variant="secondary" disabled={pending} onClick={() => void post(`/api/v1/integrations/${item.provider}/disconnect`)}>
                Disconnect
              </Button>
            </>
          ) : null}
          {!item.available ? (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => void post(`/api/v1/integrations/${item.provider}/connect`)}
            >
              Try connect
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">You can view status, but not change connections.</p>
      )}
      {feedUrl ? (
        <p className="break-all text-sm">
          Calendar feed (shown once):{" "}
          <a className="underline" href={feedUrl}>
            {feedUrl}
          </a>
        </p>
      ) : null}
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
