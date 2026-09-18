export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--line)] bg-white/60 px-6 py-12 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}

export function StatusChip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" | "bad" }) {
  const map = {
    neutral: "bg-[#ece7dc] text-[#44403c]",
    ok: "bg-[#e4f0e6] text-[#3f6f4a]",
    warn: "bg-[#f8eadc] text-[#9a4b16]",
    bad: "bg-[#f8e4e1] text-[#b42318]",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${map[tone]}`}>{children}</span>;
}
