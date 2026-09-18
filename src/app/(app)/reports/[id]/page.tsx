import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { getReport } from "@/server/services/report-service";
import { AppError } from "@/server/http";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ProjectRow";
import { ReportActions } from "@/components/ReportActions";
import { signedMediaPath } from "@/server/adapters/storage";
import type { ReportSnapshot } from "@/server/services/report-service";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  let report;
  try {
    report = await getReport(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  let snapshot: ReportSnapshot | null = null;
  try {
    snapshot = JSON.parse(report.body) as ReportSnapshot;
  } catch {
    snapshot = null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={report.title}
        description={report.project ? `${report.project.number} · ${report.project.name}` : "Report"}
        action={
          report.project ? (
            <Link href={`/projects/${report.project.id}`} className="text-sm font-medium">
              Open job
            </Link>
          ) : null
        }
      />
      <p className="text-sm text-[var(--muted)]">Status: {report.status}</p>
      {ctx.permissions.has("reports.share") || ctx.permissions.has("reports.create") ? (
        <Card title="Share & signatures">
          <ReportActions reportId={report.id} />
        </Card>
      ) : null}
      {snapshot ? (
        <>
          <Card title="Summary">
            <p className="text-sm">{snapshot.project.description || "No description."}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {snapshot.project.customer} {snapshot.project.address ? `· ${snapshot.project.address}` : ""} ·{" "}
              {snapshot.project.status}
            </p>
            {snapshot.project.customerNotes ? (
              <p className="mt-3 text-sm">
                <span className="font-medium">Customer notes: </span>
                {snapshot.project.customerNotes}
              </p>
            ) : null}
          </Card>
          <Card title="Photos">
            {snapshot.photos.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No photos in this snapshot.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {snapshot.photos.map((photo) => (
                  <figure key={photo.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={signedMediaPath(photo.id, "thumbnail")} alt={photo.filename} className="aspect-square w-full rounded-lg object-cover" />
                    <figcaption className="mt-1 text-xs text-[var(--muted)]">{photo.category}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : (
        <p className="text-sm text-[var(--muted)]">This report has no snapshot yet.</p>
      )}
      <Card title="Signatures">
        {report.signatures.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">None yet.</p>
        ) : (
          <ul className="text-sm">
            {report.signatures.map((row) => (
              <li key={row.id}>
                {row.signerName} · {row.status}
                {row.signedAt ? ` · ${row.signedAt.toLocaleString()}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
