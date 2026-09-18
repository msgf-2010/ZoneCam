import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { loadVisibleTask, listTaskComments } from "@/server/services/task-service";
import { AppError } from "@/server/http";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ProjectRow";
import { TaskDetailActions } from "@/components/TaskDetail";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  let task;
  try {
    task = await loadVisibleTask(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const comments = await listTaskComments(ctx, id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={task.title}
        description={task.project ? `${task.project.number} · ${task.project.name}` : "Company task"}
        action={
          task.project ? (
            <Link href={`/projects/${task.project.id}`} className="text-sm font-medium">
              Open job
            </Link>
          ) : null
        }
      />
      <Card title="Details">
        <p className="text-sm">{task.description || "No description."}</p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {task.status.replace("_", " ")} · {task.priority}
          {task.assignee ? ` · ${task.assignee.firstName} ${task.assignee.lastName}` : " · Unassigned"}
          {task.dueAt ? ` · due ${task.dueAt.toLocaleDateString()}` : ""}
        </p>
      </Card>
      {task.items.length > 0 ? (
        <Card title="Items">
          <ul className="space-y-2 text-sm">
            {task.items.map((item) => (
              <li key={item.id} className={item.isComplete ? "text-[var(--muted)] line-through" : ""}>
                {item.title}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card title="Activity">
        {comments.length === 0 ? (
          <p className="mb-4 text-sm text-[var(--muted)]">No comments yet.</p>
        ) : (
          <ul className="mb-4 space-y-2 text-sm">
            {comments.map((comment) => (
              <li key={comment.id}>
                {comment.body}
                <div className="text-[var(--muted)]">
                  {comment.author ? `${comment.author.firstName} ${comment.author.lastName}` : "Someone"} ·{" "}
                  {comment.createdAt.toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
        <TaskDetailActions
          taskId={task.id}
          status={task.status}
          canComplete={ctx.permissions.has("tasks.complete")}
          canEdit={ctx.permissions.has("tasks.edit")}
        />
      </Card>
    </div>
  );
}
