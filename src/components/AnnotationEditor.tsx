"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type Shape =
  | { type: "rect"; x: number; y: number; w: number; h: number }
  | { type: "circle"; x: number; y: number; r: number }
  | { type: "arrow"; x1: number; y1: number; x2: number; y2: number }
  | { type: "text"; x: number; y: number; text: string };

export function AnnotationEditor({ mediaId, imageUrl }: { mediaId: string; imageUrl: string }) {
  const [tool, setTool] = useState<"rect" | "circle" | "arrow" | "text">("rect");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch(`/api/v1/media/${mediaId}`)
      .then((r) => r.json())
      .then((json) => {
        const payload = json.data?.annotations?.[0]?.payload;
        if (payload?.shapes) setShapes(payload.shapes);
      })
      .catch(() => undefined);
  }, [mediaId]);

  function point(e: React.PointerEvent) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return { x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 };
  }

  async function save() {
    await fetch(`/api/v1/media/${mediaId}/annotations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shapes }),
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["rect", "circle", "arrow", "text"] as const).map((name) => (
          <Button key={name} type="button" variant={tool === name ? "primary" : "secondary"} onClick={() => setTool(name)}>
            {name}
          </Button>
        ))}
        <Button type="button" variant="secondary" onClick={() => setShapes([])}>
          Clear overlay
        </Button>
        <Button type="button" onClick={save}>
          Save overlay
        </Button>
      </div>
      <p className="mb-2 text-sm text-[var(--muted)]">The original file is never overwritten. Overlays are stored separately.</p>
      <div className="relative overflow-hidden rounded-[12px] border border-[var(--line)] bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="block max-h-[70vh] w-full object-contain" />
        <svg
          ref={svgRef}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onPointerDown={(e) => setDraft(point(e))}
          onPointerUp={(e) => {
            if (!draft) return;
            const end = point(e);
            if (tool === "rect") {
              setShapes((s) => [...s, { type: "rect", x: draft.x, y: draft.y, w: end.x - draft.x, h: end.y - draft.y }]);
            } else if (tool === "circle") {
              const r = Math.hypot(end.x - draft.x, end.y - draft.y);
              setShapes((s) => [...s, { type: "circle", x: draft.x, y: draft.y, r }]);
            } else if (tool === "arrow") {
              setShapes((s) => [...s, { type: "arrow", x1: draft.x, y1: draft.y, x2: end.x, y2: end.y }]);
            } else {
              const text = window.prompt("Text") ?? "";
              if (text) setShapes((s) => [...s, { type: "text", x: end.x, y: end.y, text }]);
            }
            setDraft(null);
          }}
        >
          {shapes.map((shape, i) => {
            if (shape.type === "rect") {
              return <rect key={i} x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill="none" stroke="#c45c26" strokeWidth="1.2" />;
            }
            if (shape.type === "circle") {
              return <circle key={i} cx={shape.x} cy={shape.y} r={shape.r} fill="rgba(196,92,38,0.15)" stroke="#c45c26" strokeWidth="1.2" />;
            }
            if (shape.type === "arrow") {
              return <line key={i} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke="#c45c26" strokeWidth="1.4" markerEnd="url(#arrow)" />;
            }
            return (
              <text key={i} x={shape.x} y={shape.y} fill="#c45c26" fontSize="4">
                {shape.text}
              </text>
            );
          })}
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6" fill="#c45c26" />
            </marker>
          </defs>
        </svg>
      </div>
    </div>
  );
}
