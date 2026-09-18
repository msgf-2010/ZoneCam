import { requireAuth } from "@/server/auth/context";
import { searchCompany, hrefForHit } from "@/server/services/search-service";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ProjectRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { AppError } from "@/server/http";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireAuth();
  const { q = "" } = await searchParams;
  let hits: Awaited<ReturnType<typeof searchCompany>> = [];
  let error: string | null = null;
  if (q.trim()) {
    try {
      hits = await searchCompany(ctx, q);
    } catch (err) {
      error = err instanceof AppError ? err.message : "Search failed.";
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Search" description="Jobs, customers, people, photos, notes, tasks, and reports in this company." />
      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          minLength={2}
          maxLength={80}
          placeholder="Search this company"
          className="min-h-11 min-w-48 flex-1 rounded-[10px] border border-[var(--line)] bg-white px-3"
        />
        <button type="submit" className="min-h-11 rounded-[10px] bg-[var(--brand)] px-4 font-medium text-white">
          Search
        </button>
      </form>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {!q.trim() ? (
        <EmptyState title="Search this company" body="Enter at least two characters. Results stay inside your tenant." />
      ) : hits.length === 0 && !error ? (
        <EmptyState title="No matches" body="Try a job number, customer name, or filename." />
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--line)]">
            {hits.map((hit) => (
              <li key={`${hit.index}-${hit.id}-${hit.title}`} className="py-3">
                <Link href={hrefForHit(hit)} className="font-medium">
                  {hit.title}
                </Link>
                <div className="text-sm text-[var(--muted)]">{hit.subtitle}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
