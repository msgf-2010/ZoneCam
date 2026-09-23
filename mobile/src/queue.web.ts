import type { QueueRow } from "./queue-types";

export type { QueueRow, QueueStatus } from "./queue-types";

const rows: QueueRow[] = [];

export async function enqueueCapture(row: QueueRow) {
  if (rows.some((item) => item.clientUploadId === row.clientUploadId)) return;
  rows.push(row);
}

export async function listQueue(projectId?: string) {
  return rows
    .filter((row) => (projectId ? row.projectId === projectId : true))
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export async function listPending() {
  return rows
    .filter((row) => row.status === "pending" || row.status === "failed" || row.status === "retrying")
    .sort((a, b) => a.attempts - b.attempts || a.capturedAt.localeCompare(b.capturedAt));
}

export async function updateQueue(id: string, patch: Partial<QueueRow>) {
  const row = rows.find((item) => item.id === id);
  if (row) Object.assign(row, patch);
}

export function backoffMs(attempts: number) {
  return Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6));
}
