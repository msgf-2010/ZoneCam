import Link from "next/link";
import { requireAuth } from "@/server/auth/context";
import { listCalendarProjects } from "@/server/services/project-service";
import { Card } from "@/components/ui/Card";
import { PageHeader, ProjectStatusChip } from "@/components/ProjectRow";

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

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
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const pad = start.getDay();
  const cells = Array.from({ length: pad + daysInMonth }, (_, index) => {
    if (index < pad) return null;
    return index - pad + 1;
  });
  const byDay = new Map<number, typeof projects>();
  for (const project of projects) {
    if (!project.startDate) continue;
    const day = startOfDay(new Date(project.startDate)).getDate();
    const list = byDay.get(day) ?? [];
    list.push(project);
    byDay.set(day, list);
  }

  return (
    <div>
      <PageHeader
        title="Calendar"
        description={`${start.toLocaleString("default", { month: "long", year: "numeric" })} · jobs with a start date this month. Subscribe from Integrations → Calendar.`}
      />
      <Card>
        <div className="mb-4 grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-[var(--muted)]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, index) => (
            <div
              key={index}
              className="min-h-24 rounded-xl border border-[var(--line)] bg-[#fafafa] p-1.5"
            >
              {day ? (
                <>
                  <div className="text-xs font-bold text-[var(--ink)]">{day}</div>
                  <ul className="mt-1 space-y-1">
                    {(byDay.get(day) ?? []).map((project) => (
                      <li key={project.id}>
                        <Link
                          href={`/projects/${project.id}`}
                          className="block truncate rounded-lg bg-[var(--brand-subtle)] px-1.5 py-1 text-[11px] font-semibold text-[var(--brand)]"
                        >
                          {project.number} {project.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
      {projects.length > 0 ? (
        <div className="mt-6">
          <Card title="This month">
            <ul>
              {projects.map((project) => (
                <li key={project.id} className="flex items-center justify-between border-b border-[var(--line)] py-3 last:border-0">
                  <div>
                    <Link href={`/projects/${project.id}`} className="font-semibold">
                      {project.startDate ? new Date(project.startDate).toLocaleDateString() : ""} · {project.number}{" "}
                      {project.name}
                    </Link>
                    <div className="text-sm text-[var(--muted)]">{project.customer?.name}</div>
                  </div>
                  <ProjectStatusChip name={project.projectStatus.name} color={project.projectStatus.color} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
