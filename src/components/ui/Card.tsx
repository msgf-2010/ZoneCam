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
    <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-elevated)] p-5">
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
