export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
      <h3 className="text-base font-bold text-[var(--ink)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}

export function StatusChip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const map = {
    neutral: "bg-[#f5f5f5] text-[#525252]",
    ok: "bg-[#05eb7624] text-[#059669]",
    warn: "bg-[#ffd40045] text-[#b45309]",
    bad: "bg-[#ff6a551a] text-[#ff6a55]",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}
