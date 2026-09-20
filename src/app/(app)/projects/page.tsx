import Link from "next/link";
import { requireAuth } from "@/server/auth/context";
import { listProjects } from "@/server/services/project-service";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import { PageHeader, ProjectRow } from "@/components/ProjectRow";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const ctx = await requireAuth();
  if (!ctx.permissions.has("projects.view")) {
    return <p>You do not have permission to view jobs.</p>;
  }
  const params = await searchParams;
  const projects = await listProjects(ctx, { q: params.q, statusKey: params.status });
  const canCreate = ctx.permissions.has("projects.create");

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Jobs for this company."
        action={
          canCreate ? (
            <Link href="/projects/new">
              <Button>New job</Button>
            </Link>
          ) : null
        }
      />
      <form className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-white p-3">
        <div className="min-w-48 flex-1">
          <Input name="q" defaultValue={params.q} placeholder="Search jobs" />
        </div>
        <div className="w-40">
          <Select name="status" defaultValue={params.status}>
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      {projects.length === 0 ? (
        <EmptyState title="No jobs found" body="Create a job or adjust the filters." />
      ) : (
        <Card>
          {projects.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </Card>
      )}
    </div>
  );
}
