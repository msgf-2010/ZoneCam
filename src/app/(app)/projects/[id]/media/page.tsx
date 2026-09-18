import { requireAuth } from "@/server/auth/context";
import { loadScopedProject } from "@/server/tenancy/access";
import { PageHeader } from "@/components/ProjectRow";
import { MediaGallery } from "@/components/MediaGallery";
import { AppError } from "@/server/http";
import { notFound } from "next/navigation";

export default async function ProjectMediaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  try {
    await loadScopedProject(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  return (
    <div>
      <PageHeader title="Job media" description="Thumbnails first. Originals stay in object storage." />
      <MediaGallery
        projectId={id}
        canUpload={ctx.permissions.has("media.upload")}
        canDelete={ctx.permissions.has("media.delete")}
        canAnnotate={ctx.permissions.has("media.annotate")}
      />
    </div>
  );
}
