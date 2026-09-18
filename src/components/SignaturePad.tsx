"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function SignaturePad({ token }: { token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1c1917";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPending(true);
    const res = await fetch(`/api/v1/public/reports/${token}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signerName: name, imageDataUrl: canvas.toDataURL("image/png") }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    setStatus(res.ok ? "Signed. Thank you." : json.error ?? "Could not save signature.");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Your name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <canvas
        ref={canvasRef}
        width={520}
        height={180}
        className="w-full rounded-[10px] border border-[var(--line)] bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerLeave={() => {
          drawing.current = false;
        }}
      />
      <Button type="submit" disabled={pending || !name.trim()}>
        {pending ? "Saving…" : "Sign report"}
      </Button>
      {status ? <p className="text-sm">{status}</p> : null}
    </form>
  );
}
