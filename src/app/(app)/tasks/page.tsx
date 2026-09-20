import { requireAuth } from "@/server/auth/context";
import { listProjectMeta } from "@/server/services/project-service";
import { listTasks } from "@/server/services/task-service";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ProjectRow";
import { TaskCreateForm, TaskList } from "@/components/TaskBoard";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const ctx = await requireAuth();
  const [tasks, meta] = await Promise.all([listTasks(ctx), listProjectMeta(ctx)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Work assigned across jobs. Completing a task writes to the project timeline." />
      {ctx.permissions.has("tasks.create") ? (
        <Card title="New task">
          <TaskCreateForm members={meta.members} canCreate />
        </Card>
      ) : null}
      <Card title="Company tasks">
        <TaskList
          canComplete={ctx.permissions.has("tasks.complete")}
          tasks={tasks.map((task) => ({
            ...task,
            dueAt: task.dueAt ? task.dueAt.toISOString() : null,
          }))}
        />
      </Card>
    </div>
  );
}
