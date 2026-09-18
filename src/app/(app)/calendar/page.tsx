import Link from "next/link";
import { requireAuth } from "@/server/auth/context";
import { listCalendarProjects } from "@/server/services/project-service";
import { Card } from "@/components/ui/Card";
import { PageHeader, ProjectStatusChip } from "@/components/ProjectRow";

export default async function CalendarPage() {
  const ctx = await requireAuth();
  if (!ctx.permissions.has("projects.view")) {
    return <p>You do not have permission to view the calendar.</p>;
  }
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  const projects = await listCalendarProjects(ctx, start, end);

  return (
    <div>
      <PageHeader
        title="Calendar"
        description={`${start.toLocaleString("default", { month: "long", year: "numeric" })} · jobs with a start date this month. Subscribe from Integrations → Calendar.`}
      />
      <Card>
        {projects.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No dated jobs this month.</p>
        ) : (
          <ul>
            {projects.map((project) => (
              <li key={project.id} className="flex items-center justify-between border-b border-[var(--line)] py-3">
                <div>
                  <Link href={`/projects/${project.id}`} className="font-medium">
                    {project.startDate ? new Date(project.startDate).toLocaleDateString() : ""} · {project.number}{" "}
                    {project.name}
                  </Link>
                  <div className="text-sm text-[var(--muted)]">{project.customer?.name}</div>
                </div>
                <ProjectStatusChip name={project.projectStatus.name} color={project.projectStatus.color} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
