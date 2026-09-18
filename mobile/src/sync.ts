import { getApiBase, getToken } from "./api";
import { backoffMs, listPending, updateQueue, type QueueRow } from "./queue";

let flushing = false;

export async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    const pending = await listPending();
    for (const row of pending) {
      if (row.attempts > 0) {
        const wait = backoffMs(row.attempts);
        await new Promise((r) => setTimeout(r, Math.min(wait, 50)));
      }
      await uploadRow(row);
    }
  } finally {
    flushing = false;
  }
}

async function uploadRow(row: QueueRow) {
  await updateQueue(row.id, { status: "uploading", attempts: row.attempts + 1 });
  try {
    const token = await getToken();
    const base = await getApiBase();
    const form = new FormData();
    form.append("files", {
      uri: row.localUri,
      name: row.filename,
      type: row.mimeType,
    } as unknown as Blob);
    form.append(
      "metadata",
      JSON.stringify([
        {
          capturedAt: row.capturedAt,
          latitude: row.latitude,
          longitude: row.longitude,
          clientUploadId: row.clientUploadId,
          deviceInfo: "zonecam-mobile",
        },
      ]),
    );
    const res = await fetch(`${base}/api/v1/projects/${row.projectId}/media`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
    await updateQueue(row.id, {
      status: "uploaded",
      serverMediaId: json.data?.[0]?.id ?? null,
      lastError: null,
    });
  } catch (error) {
    await updateQueue(row.id, {
      status: "failed",
      lastError: error instanceof Error ? error.message : "Upload failed",
    });
  }
}

export async function queueSummary(projectId?: string) {
  const { listQueue } = await import("./queue");
  const rows = await listQueue(projectId);
  const pending = rows.filter((r) => r.status === "pending" || r.status === "retrying").length;
  const uploading = rows.filter((r) => r.status === "uploading").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const uploaded = rows.filter((r) => r.status === "uploaded").length;
  return { pending, uploading, failed, uploaded, total: rows.length };
}
