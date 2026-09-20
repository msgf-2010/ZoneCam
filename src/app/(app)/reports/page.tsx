import Link from "next/link";
import { requireAuth } from "@/server/auth/context";
import { listReports } from "@/server/services/report-service";
import { listProjects } from "@/server/services/project-service";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ProjectRow";
import { ReportCreateForm } from "@/components/ReportActions";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const ctx = await requireAuth();
  const [reports, projects] = await Promise.all([listReports(ctx), listProjects(ctx)]);
  const canCreate = ctx.permissions.has("reports.create");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Job snapshots for customers. Internal notes are never included on the share link."
      />
      {canCreate ? (
        <Card title="New report">
          <ReportCreateForm projects={projects.map((job) => ({ id: job.id, number: job.number, name: job.name }))} />
        </Card>
      ) : null}
      <Card title="Company reports">
        {reports.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No reports yet.</p>
        ) : (
          <ul>
            {reports.map((report) => (
              <li key={report.id} className="flex items-center justify-between border-b border-[var(--line)] py-3 last:border-0">
                <Link href={`/reports/${report.id}`} className="font-medium">
                  {report.title}
                </Link>
                <span className="flex items-center gap-3 text-[var(--muted)]">
                  {report.project ? report.project.number : ""}
                  <StatusChip tone={report.status === "shared" || report.status === "signed" ? "ok" : "neutral"}>
                    {report.status}
                  </StatusChip>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
