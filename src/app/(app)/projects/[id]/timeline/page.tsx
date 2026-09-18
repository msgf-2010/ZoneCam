import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { listProjectTimeline } from "@/server/services/timeline-service";
import { getProject } from "@/server/services/project-service";
import { AppError } from "@/server/http";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ProjectRow";
import { TimelineFeed } from "@/components/TaskBoard";

export const dynamic = "force-dynamic";

export default async function ProjectTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  let project;
  try {
    project = await getProject(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const timeline = await listProjectTimeline(ctx, id, { take: 40 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timeline"
        description={`${project.number} · ${project.name}`}
        action={
          <Link href={`/projects/${project.id}`} className="text-sm font-medium">
            Back to job
          </Link>
        }
      />
      <Card>
        <TimelineFeed projectId={project.id} events={timeline.items} />
      </Card>
    </div>
  );
}
