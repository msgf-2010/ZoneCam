import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { getProject, listProjectMeta } from "@/server/services/project-service";
import { listReports } from "@/server/services/report-service";
import { listPayments } from "@/server/services/payment-service";
import { listChecklistTemplates } from "@/server/services/checklist-service";
import { listProjectMessages } from "@/server/services/message-service";
import { MessageThread } from "@/components/MessageThread";
import { ChecklistBoard, TaskCreateForm, TaskList, TimelineFeed } from "@/components/TaskBoard";
import { canStartAssignedJob } from "@/server/tenancy/access";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, ProjectStatusChip } from "@/components/ProjectRow";
import { JobActions } from "@/components/JobActions";
import { JobInspectorActions } from "@/components/JobInspectorActions";
import { signedMediaPath } from "@/server/adapters/storage";
import { directionsUrl, formatAddress, mapsUrl } from "@/lib/format";
import { AppError } from "@/server/http";

export default async function ProjectDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  let project;
  try {
    project = await getProject(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const [meta, templates, messages, reports, payments] = await Promise.all([
    listProjectMeta(ctx),
    listChecklistTemplates(ctx),
    listProjectMessages(ctx, id),
    listReports(ctx, id),
    ctx.permissions.has("payments.view") ? listPayments(ctx, id) : Promise.resolve([]),
  ]);

  const address = formatAddress(project);
  const map = mapsUrl({ latitude: project.latitude, longitude: project.longitude, address });
  const directions = directionsUrl({ latitude: project.latitude, longitude: project.longitude, address });
  const canEdit = ctx.permissions.has("projects.edit");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${project.number} · ${project.name}`}
        description={project.projectType?.name ?? "Job"}
        action={
          <div className="flex flex-wrap gap-2">
            {directions ? (
              <a href={directions} target="_blank" rel="noreferrer">
                <Button variant="secondary" className="min-h-12">
                  Navigate
                </Button>
              </a>
            ) : null}
            {canEdit ? (
              <Link href={`/projects/${project.id}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>
            ) : null}
            <Link href={`/projects/${project.id}/timeline`}>
              <Button variant="secondary">Timeline</Button>
            </Link>
            <Link href={`/projects/${project.id}/media`}>
              <Button>Photos</Button>
            </Link>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <ProjectStatusChip name={project.projectStatus.name} color={project.projectStatus.color} />
        {project.startDate ? (
          <span className="text-sm text-[var(--muted)]">Start {new Date(project.startDate).toLocaleDateString()}</span>
        ) : null}
        {project.expectedCompletionDate ? (
          <span className="text-sm text-[var(--muted)]">
            Due {new Date(project.expectedCompletionDate).toLocaleDateString()}
          </span>
        ) : null}
      </div>

      <JobActions
        projectId={project.id}
        statusKey={project.projectStatus.key}
        canEdit={canStartAssignedJob(ctx)}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Summary">
          <p className="text-sm">{project.description || "No description."}</p>
        </Card>
        <Card title="Customer">
          {project.customer ? (
            <div className="text-sm">
              <Link href={`/customers/${project.customer.id}`} className="font-medium">
                {project.customer.name}
              </Link>
              {project.customerContact ? (
                <p className="mt-2 text-[var(--muted)]">
                  {project.customerContact.firstName} {project.customerContact.lastName}
                  <br />
                  {project.customerContact.phone || project.customerContact.email}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">No customer linked.</p>
          )}
        </Card>
        <Card title="Location">
          <p className="text-sm">{address || "No address."}</p>
          {project.latitude != null && project.longitude != null ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              {project.latitude.toFixed(5)}, {project.longitude.toFixed(5)}
            </p>
          ) : null}
          {map ? (
            <a className="mt-3 inline-block text-sm font-medium" href={map} target="_blank" rel="noreferrer">
              Open map
            </a>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Team">
          {project.members.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No one assigned.</p>
          ) : (
            <ul className="text-sm">
              {project.members.map((m) => (
                <li key={m.id} className="py-1">
                  {m.user.firstName} {m.user.lastName}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Notes">
          <p className="mb-3 text-sm">
            <span className="font-medium">Internal: </span>
            {project.internalNotes || "None"}
          </p>
          <p className="mb-3 text-sm">
            <span className="font-medium">Customer-facing: </span>
            {project.customerNotes || "None"}
          </p>
          {project.notes.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No activity notes yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {project.notes.map((note) => (
                <li key={note.id}>
                  {note.body}
                  <div className="text-[var(--muted)]">
                    {note.author ? `${note.author.firstName} ${note.author.lastName}` : "System"} ·{" "}
                    {note.createdAt.toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Inspector">
          <JobInspectorActions
            projectId={project.id}
            canSummarize={ctx.permissions.has("projects.edit")}
            canChecklist={ctx.permissions.has("tasks.create")}
          />
        </Card>
      </div>

      <Card title="Timeline" actions={<Link href={`/projects/${project.id}/timeline`}>Full timeline</Link>}>
        <TimelineFeed projectId={project.id} events={project.timelineEvents} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Photos" actions={<Link href={`/projects/${project.id}/media`}>Open gallery</Link>}>
          {project.media.length === 0 ? (
            <EmptyState title="No photos yet" body="Upload from the gallery or capture with the ZoneCam mobile app." />
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {project.media.map((item) => (
                <Link key={item.id} href={`/projects/${project.id}/media`} className="block overflow-hidden rounded-md bg-[#ece7dc]">
                  {item.type === "photo" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      loading="lazy"
                      decoding="async"
                      src={signedMediaPath(item.id, "thumbnail")}
                      alt={item.originalFilename}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <span className="flex aspect-square items-center justify-center px-1 text-center text-[10px] text-[var(--muted)]">
                      {item.originalFilename}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card title="Tasks" actions={<Link href="/tasks">All tasks</Link>}>
          <div className="space-y-4">
            <TaskCreateForm
              projectId={project.id}
              members={meta.members}
              canCreate={ctx.permissions.has("tasks.create")}
            />
            <TaskList
              canComplete={ctx.permissions.has("tasks.complete")}
              tasks={project.tasks.map((task) => ({
                ...task,
                project: { id: project.id, name: project.name, number: project.number },
                dueAt: task.dueAt ? task.dueAt.toISOString() : null,
              }))}
            />
          </div>
        </Card>
        <Card title="Reports" actions={<Link href="/reports">All reports</Link>}>
          {reports.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No reports for this job yet.</p>
          ) : (
            <ul className="text-sm">
              {reports.map((report) => (
                <li key={report.id}>
                  <Link href={`/reports/${report.id}`}>{report.title}</Link>
                  <span className="text-[var(--muted)]"> · {report.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Payments" actions={<Link href="/payments">All payments</Link>}>
          {payments.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No payment requests for this job yet.</p>
          ) : (
            <ul className="text-sm">
              {payments.map((payment) => (
                <li key={payment.id}>
                  <Link href={`/payments/${payment.id}`}>{payment.description}</Link>
                  <span className="text-[var(--muted)]"> · {payment.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Messages" actions={<Link href={`/messages?project=${project.id}`}>Open inbox</Link>}>
        <MessageThread
          key={project.id}
          projectId={project.id}
          initial={messages.map((row) => ({
            id: row.id,
            body: row.body,
            createdAt: row.createdAt.toISOString(),
            author: row.author,
          }))}
        />
      </Card>

      <Card title="Checklists">
        <ChecklistBoard
          projectId={project.id}
          checklists={project.checklists}
          templates={templates.map((t) => ({ id: t.id, name: t.name }))}
          canCreate={ctx.permissions.has("tasks.create")}
          canComplete={ctx.permissions.has("tasks.complete")}
        />
      </Card>
    </div>
  );
}
