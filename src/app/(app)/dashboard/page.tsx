import Link from "next/link";
import { requireAuth } from "@/server/auth/context";
import { getDashboard } from "@/server/services/project-service";
import { listOutstandingTasks } from "@/server/services/task-service";
import { Card, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader, ProjectRow } from "@/components/ProjectRow";

export default async function DashboardPage() {
  const ctx = await requireAuth();
  const [data, outstanding] = await Promise.all([getDashboard(ctx), listOutstandingTasks(ctx, 8)]);
  const canCreate = ctx.permissions.has("projects.create");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`What needs attention at ${data.company.name}.`}
        action={
          canCreate ? (
            <Link href="/projects/new">
              <Button>New job</Button>
            </Link>
          ) : null
        }
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Active jobs" value={data.stats.activeProjects} />
        <StatCard label="Today" value={data.stats.today} />
        <StatCard label="Needs attention" value={data.stats.attention} />
        <StatCard label="Team" value={data.stats.members} />
      </div>
      <Card title="Today's jobs">
        {data.today.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No jobs scheduled for today.</p>
        ) : (
          data.today.map((project) => <ProjectRow key={project.id} project={project} />)
        )}
      </Card>
      <Card title="Needs attention" description="On hold or past expected completion.">
        {data.attention.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing waiting on the office.</p>
        ) : (
          data.attention.map((project) => <ProjectRow key={project.id} project={project} />)
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Recent jobs">
          {data.recent.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No jobs yet.</p>
          ) : (
            data.recent.map((project) => <ProjectRow key={project.id} project={project} />)
          )}
        </Card>
        <Card title="Outstanding tasks">
          {outstanding.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No open tasks.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)] text-sm">
              {outstanding.map((task) => (
                <li key={task.id} className="py-2">
                  <Link href={`/tasks/${task.id}`} className="font-medium">
                    {task.title}
                  </Link>
                  <div className="text-[var(--muted)]">
                    {task.project ? `${task.project.number} · ${task.project.name}` : "No job"}
                    {task.dueAt ? ` · due ${task.dueAt.toLocaleDateString()}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recent activity">
          {data.recentAudit.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)] text-sm">
              {data.recentAudit.map((row) => (
                <li key={row.id} className="py-2">
                  <div className="font-medium">{row.action}</div>
                  <div className="text-[var(--muted)]">
                    {row.actor} · {row.createdAt.toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
