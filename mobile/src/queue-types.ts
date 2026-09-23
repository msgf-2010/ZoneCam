export type QueueStatus = "pending" | "uploading" | "uploaded" | "failed" | "retrying";

export type QueueRow = {
  id: string;
  projectId: string;
  localUri: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  capturedAt: string;
  latitude: number | null;
  longitude: number | null;
  clientUploadId: string;
  status: QueueStatus;
  attempts: number;
  lastError: string | null;
  serverMediaId: string | null;
  category: string | null;
  description: string | null;
};
