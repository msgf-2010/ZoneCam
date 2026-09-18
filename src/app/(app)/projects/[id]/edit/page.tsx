import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { getProject } from "@/server/services/project-service";
import { ProjectEditor } from "@/components/editors";
import { PageHeader } from "@/components/ProjectRow";
import { AppError } from "@/server/http";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  if (!ctx.permissions.has("projects.edit")) {
    return <p>You do not have permission to edit jobs.</p>;
  }
  try {
    await getProject(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  return (
    <div>
      <PageHeader title="Edit job" />
      <ProjectEditor projectId={id} />
    </div>
  );
}
