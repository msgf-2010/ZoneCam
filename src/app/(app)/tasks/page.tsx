import { requireAuth } from "@/server/auth/context";
import { listProjectMeta } from "@/server/services/project-service";
import { listTasks } from "@/server/services/task-service";
import { PageHeader } from "@/components/ProjectRow";
import { TaskCreateForm, TaskList } from "@/components/TaskBoard";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const ctx = await requireAuth();
  const [tasks, meta] = await Promise.all([listTasks(ctx), listProjectMeta(ctx)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Work assigned across jobs. Completing a task writes to the project timeline." />
      <TaskCreateForm members={meta.members} canCreate={ctx.permissions.has("tasks.create")} />
      <TaskList
        canComplete={ctx.permissions.has("tasks.complete")}
        tasks={tasks.map((task) => ({
          ...task,
          dueAt: task.dueAt ? task.dueAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
