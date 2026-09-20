import Link from "next/link";
import { requireAuth } from "@/server/auth/context";
import { listMessageThreads, listProjectMessages } from "@/server/services/message-service";
import { listProjects } from "@/server/services/project-service";
import { Card } from "@/components/ui/Card";
import { MessageThread } from "@/components/MessageThread";
import { PageHeader } from "@/components/ProjectRow";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const ctx = await requireAuth();
  const { project: selected } = await searchParams;
  const [threads, jobs] = await Promise.all([listMessageThreads(ctx), listProjects(ctx)]);
  const projectId = selected && jobs.some((job) => job.id === selected) ? selected : threads[0]?.projectId ?? jobs[0]?.id;
  const messages = projectId ? await listProjectMessages(ctx, projectId) : [];
  const current = jobs.find((job) => job.id === projectId);

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description="Job threads between field and office. Use @First Last to mention someone." />
      <div className="grid min-h-[calc(100vh-12rem)] gap-4 lg:grid-cols-[280px_1fr]">
        <Card title="Jobs">
          {jobs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Create a job to start a thread.</p>
          ) : (
            <ul className="text-sm">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/messages?project=${job.id}`}
                    className={`block rounded-xl px-3 py-2.5 ${job.id === projectId ? "bg-[var(--brand-subtle)] font-semibold text-[var(--brand)]" : "hover:bg-[#fafafa]"}`}
                  >
                    {job.number} · {job.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={current ? `${current.number} · ${current.name}` : "Thread"}>
          {projectId ? (
            <MessageThread
              key={projectId}
              projectId={projectId}
              initial={messages.map((row) => ({
                id: row.id,
                body: row.body,
                createdAt: row.createdAt.toISOString(),
                author: row.author,
              }))}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">No conversation selected.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
