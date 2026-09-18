"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type Item = { file: File; progress: number; status: "queued" | "uploading" | "done" | "error"; error?: string; abort?: AbortController };

export function MediaUploader({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);

  function queueFiles(list: FileList | File[]) {
    const next = Array.from(list).map((file) => ({ file, progress: 0, status: "queued" as const }));
    setItems((current) => [...current, ...next]);
    void uploadAll(next);
  }

  async function uploadAll(batch: Item[]) {
    for (const item of batch) {
      const controller = new AbortController();
      item.abort = controller;
      item.status = "uploading";
      setItems((current) => [...current]);
      try {
        await uploadWithProgress(projectId, [item.file], controller.signal, (pct) => {
          item.progress = pct;
          setItems((current) => [...current]);
        });
        item.status = "done";
        item.progress = 100;
      } catch (error) {
        if (controller.signal.aborted) {
          item.status = "error";
          item.error = "Cancelled";
        } else {
          item.status = "error";
          item.error = error instanceof Error ? error.message : "Upload failed";
        }
      }
      setItems((current) => [...current]);
    }
    onUploaded();
  }

  async function retry(item: Item) {
    item.status = "queued";
    item.error = undefined;
    item.progress = 0;
    setItems((current) => [...current]);
    await uploadAll([item]);
  }

  return (
    <div>
      <div
        className={`rounded-[var(--radius)] border-2 border-dashed px-4 py-8 text-center ${drag ? "border-[var(--brand)] bg-white" : "border-[var(--line)] bg-white/70"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) queueFiles(e.dataTransfer.files);
        }}
      >
        <p className="font-medium">Drop photos or videos here</p>
        <p className="mt-1 text-sm text-[var(--muted)]">JPEG, PNG, WebP, GIF, MP4, MOV. They attach to this job automatically.</p>
        <Button className="mt-4 min-h-12" type="button" onClick={() => inputRef.current?.click()}>
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/mp4,video/quicktime,video/webm"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) queueFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {items.length ? (
        <ul className="mt-4 space-y-2 text-sm">
          {items.map((item, index) => (
            <li key={`${item.file.name}-${index}`} className="rounded-lg border border-[var(--line)] bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{item.file.name}</span>
                <span className="text-[var(--muted)]">{item.status}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded bg-[var(--line)]">
                <div className="h-full bg-[var(--brand)]" style={{ width: `${item.progress}%` }} />
              </div>
              {item.error ? <p className="mt-1 text-[var(--danger)]">{item.error}</p> : null}
              <div className="mt-2 flex gap-2">
                {item.status === "uploading" ? (
                  <button type="button" className="text-sm" onClick={() => item.abort?.abort()}>
                    Cancel
                  </button>
                ) : null}
                {item.status === "error" ? (
                  <button type="button" className="text-sm" onClick={() => retry(item)}>
                    Retry
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function uploadWithProgress(projectId: string, files: File[], signal: AbortSignal, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/v1/projects/${projectId}/media`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        try {
          reject(new Error(JSON.parse(xhr.responseText).error ?? "Upload failed"));
        } catch {
          reject(new Error("Upload failed"));
        }
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(new Error("Cancelled"));
    signal.addEventListener("abort", () => xhr.abort());
    const form = new FormData();
    for (const file of files) form.append("files", file);
    form.append(
      "metadata",
      JSON.stringify(
        files.map((file) => ({
          capturedAt: new Date(file.lastModified).toISOString(),
          clientUploadId: crypto.randomUUID(),
        })),
      ),
    );
    xhr.send(form);
  });
}
