"use client";

import { useState } from "react";

type Shot = { id: string; urls: { thumbnail: string }; originalFilename: string };

export function FieldCapture({
  projectId,
  category,
  existing,
}: {
  projectId: string;
  category: string;
  existing: Shot[];
}) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [shots, setShots] = useState<Shot[]>(existing);

  async function send(files: File[]) {
    if (files.length === 0) return;
    setPending(true);
    setStatus(files.length === 1 ? "Saving photo…" : `Saving ${files.length}…`);
    const form = new FormData();
    const metadata = files.map((file) => ({
      capturedAt: new Date().toISOString(),
      category,
      description: note.trim() || null,
      clientUploadId: `${projectId}-${category}-${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }));
    for (const file of files) form.append("files", file);
    form.set("metadata", JSON.stringify(metadata));
    form.set("category", category);
    const res = await fetch(`/api/v1/projects/${projectId}/media`, { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setStatus(json.error ?? "Upload failed. Try again.");
      return;
    }
    const uploaded = (json.data ?? []) as Shot[];
    if (uploaded.length) setShots((current) => [...uploaded, ...current]);
    setStatus("Saved. Take another whenever you’re ready.");
  }

  async function saveNote() {
    if (!note.trim()) return;
    setPending(true);
    await fetch(`/api/v1/projects/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: `${category}: ${note.trim()}`, visibility: "internal" }),
    });
    setPending(false);
    setNote("");
    setStatus("Note saved.");
  }

  return (
    <div className="field-stack">
      <div className="field-shutter-wrap">
        <span className="field-shutter">{pending ? "Saving…" : "Take photo"}</span>
        <input
          className="field-file-hit"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={pending}
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = "";
            if (files.length) void send(files);
          }}
        />
      </div>
      <div className="field-shutter-wrap field-shutter-wrap-secondary">
        <span className="field-secondary field-secondary-fill">Add from gallery</span>
        <input
          className="field-file-hit"
          type="file"
          accept="image/*"
          multiple
          disabled={pending}
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = "";
            if (files.length) void send(files);
          }}
        />
      </div>
      <label className="field-label">Note for the office</label>
      <textarea
        className="field-note"
        rows={3}
        placeholder="Anything they should know about these shots…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button type="button" className="field-secondary" disabled={pending || !note.trim()} onClick={() => void saveNote()}>
        Save note only
      </button>
      {status ? <p className="field-status">{status}</p> : null}
      {shots.length > 0 ? (
        <div>
          <p className="field-label">
            {shots.length} in {category}
          </p>
          <div className="field-thumbs">
            {shots.map((item) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={item.id} src={item.urls.thumbnail} alt={item.originalFilename} />
            ))}
          </div>
        </div>
      ) : (
        <p className="field-empty">No photos in this category yet.</p>
      )}
    </div>
  );
}
