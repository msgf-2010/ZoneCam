import Link from "next/link";
import { requireAuth } from "@/server/auth/context";
import { listProjects } from "@/server/services/project-service";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
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
      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Search jobs"
          className="min-h-11 min-w-48 flex-1 rounded-[10px] border border-[var(--line)] bg-white px-3"
        />
        <select
          name="status"
          defaultValue={params.status}
          className="min-h-11 rounded-[10px] border border-[var(--line)] bg-white px-3"
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
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
