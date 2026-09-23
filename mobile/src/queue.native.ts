import * as SQLite from "expo-sqlite";
import type { QueueRow } from "./queue-types";

export type { QueueRow, QueueStatus } from "./queue-types";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync("zonecam-queue.db");
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS upload_queue (
        id TEXT PRIMARY KEY NOT NULL,
        projectId TEXT NOT NULL,
        localUri TEXT NOT NULL,
        filename TEXT NOT NULL,
        mimeType TEXT NOT NULL,
        sizeBytes INTEGER NOT NULL,
        capturedAt TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        clientUploadId TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        lastError TEXT,
        serverMediaId TEXT
      );
    `);
    await db.execAsync(`ALTER TABLE upload_queue ADD COLUMN category TEXT`).catch(() => undefined);
    await db.execAsync(`ALTER TABLE upload_queue ADD COLUMN description TEXT`).catch(() => undefined);
  }
  return db;
}

export async function enqueueCapture(row: QueueRow) {
  const database = await getDb();
  await database.runAsync(
    `INSERT OR IGNORE INTO upload_queue
      (id, projectId, localUri, filename, mimeType, sizeBytes, capturedAt, latitude, longitude, clientUploadId, status, attempts, lastError, serverMediaId, category, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.projectId,
      row.localUri,
      row.filename,
      row.mimeType,
      row.sizeBytes,
      row.capturedAt,
      row.latitude,
      row.longitude,
      row.clientUploadId,
      row.status,
      row.attempts,
      row.lastError,
      row.serverMediaId,
      row.category,
      row.description,
    ],
  );
}

export async function listQueue(projectId?: string) {
  const database = await getDb();
  if (projectId) {
    return database.getAllAsync<QueueRow>("SELECT * FROM upload_queue WHERE projectId = ? ORDER BY capturedAt DESC", [
      projectId,
    ]);
  }
  return database.getAllAsync<QueueRow>("SELECT * FROM upload_queue ORDER BY capturedAt DESC");
}

export async function listPending() {
  const database = await getDb();
  return database.getAllAsync<QueueRow>(
    "SELECT * FROM upload_queue WHERE status IN ('pending', 'failed', 'retrying') ORDER BY attempts ASC, capturedAt ASC",
  );
}

export async function updateQueue(id: string, patch: Partial<QueueRow>) {
  const database = await getDb();
  const entries = Object.entries(patch);
  if (!entries.length) return;
  const sql = `UPDATE upload_queue SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE id = ?`;
  await database.runAsync(sql, [...entries.map(([, value]) => value), id]);
}

export function backoffMs(attempts: number) {
  return Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6));
}
