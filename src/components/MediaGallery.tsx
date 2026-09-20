"use client";

import { useCallback, useEffect, useState } from "react";
import { MediaUploader } from "@/components/MediaUploader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";

type MediaItem = {
  id: string;
  type: string;
  originalFilename: string;
  capturedAt: string | null;
  processingStatus: string;
  description: string;
  urls: { original: string; thumbnail: string };
  tags: Array<{ id: string; name: string }>;
};

export function MediaGallery({
  projectId,
  canUpload,
  canDelete,
  canAnnotate,
}: {
  projectId: string;
  canUpload: boolean;
  canDelete: boolean;
  canAnnotate: boolean;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [active, setActive] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [inspecting, setInspecting] = useState(false);

  const load = useCallback(
    async (reset = false) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (type) params.set("type", type);
      if (!reset && cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/v1/projects/${projectId}/media?${params.toString()}`);
      const json = await res.json();
      setLoading(false);
      if (!res.ok) return;
      setItems((current) => (reset ? json.data.items : [...current, ...json.data.items]));
      setCursor(json.data.nextCursor);
    },
    [projectId, q, type, cursor],
  );

  useEffect(() => {
    setCursor(null);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, q, type]);

  async function remove(id: string) {
    await fetch(`/api/v1/media/${id}`, { method: "DELETE" });
    setItems((current) => current.filter((item) => item.id !== id));
    setActive(null);
  }

  async function inspect(id: string) {
    setInspecting(true);
    const res = await fetch(`/api/v1/media/${id}/analyze`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setInspecting(false);
    if (!res.ok) {
      window.alert(json.error ?? "Inspector could not run.");
      return;
    }
    const description = json.data?.description ?? "";
    setItems((current) => current.map((item) => (item.id === id ? { ...item, description } : item)));
    setActive((current) => (current && current.id === id ? { ...current, description } : current));
  }

  async function addTag(id: string) {
    const name = window.prompt("Tag name");
    if (!name) return;
    await fetch(`/api/v1/media/${id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: [name] }),
    });
    void load(true);
  }

  return (
    <div className="space-y-4">
      {canUpload ? <MediaUploader projectId={projectId} onUploaded={() => load(true)} /> : null}
      <div className="flex flex-wrap gap-2">
        <div className="min-w-48 flex-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search filenames"
          />
        </div>
        <div className="w-36">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All media</option>
            <option value="photo">Photos</option>
            <option value="video">Videos</option>
          </Select>
        </div>
      </div>
      {items.length === 0 && !loading ? (
        <EmptyState title="No media yet" body="Upload from the web or capture from the ZoneCam mobile app." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white text-left"
              onClick={() => setActive(item)}
            >
              {item.type === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.urls.thumbnail} alt="" loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-[#f5f5f5] text-sm">Video</div>
              )}
              <div className="truncate px-2 py-1 text-xs">{item.originalFilename}</div>
            </button>
          ))}
        </div>
      )}
      {cursor ? (
        <Button variant="secondary" disabled={loading} onClick={() => load(false)}>
          Load more
        </Button>
      ) : null}
      {active ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setActive(null)}>
          <div className="max-h-[90vh] max-w-4xl overflow-auto rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            {active.type === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.urls.original} alt={active.originalFilename} className="max-h-[70vh] w-full object-contain" />
            ) : (
              <video src={active.urls.original} controls className="max-h-[70vh] w-full" />
            )}
            {active.description ? <p className="mt-3 text-sm">{active.description}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`/api/v1/media/${active.id}/download`}>
                <Button variant="secondary">Download</Button>
              </a>
              {canAnnotate && active.type === "photo" ? (
                <Button variant="secondary" disabled={inspecting} onClick={() => void inspect(active.id)}>
                  {inspecting ? "Inspecting…" : "Inspect photo"}
                </Button>
              ) : null}
              {canAnnotate && active.type === "photo" ? (
                <a href={`/projects/${projectId}/media/${active.id}`}>
                  <Button variant="secondary">Annotate</Button>
                </a>
              ) : null}
              {canUpload ? (
                <Button variant="secondary" onClick={() => addTag(active.id)}>
                  Tag
                </Button>
              ) : null}
              {canDelete ? (
                <Button variant="danger" onClick={() => remove(active.id)}>
                  Delete
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setActive(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
