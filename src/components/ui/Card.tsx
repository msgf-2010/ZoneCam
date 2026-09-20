export function Card({
  title,
  description,
  children,
  actions,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white">
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-3">
          <div>
            {title ? <h2 className="text-base font-bold text-[var(--ink)]">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
      <div className="text-sm font-medium text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-3xl font-bold text-[var(--ink)]">{value}</div>
    </section>
  );
}
