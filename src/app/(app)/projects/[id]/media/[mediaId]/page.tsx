import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { getMedia } from "@/server/services/media-service";
import { AnnotationEditor } from "@/components/AnnotationEditor";
import { PageHeader } from "@/components/ProjectRow";
import { AppError } from "@/server/http";

export default async function AnnotatePage({ params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const { id, mediaId } = await params;
  const ctx = await requireAuth();
  if (!ctx.permissions.has("media.annotate")) {
    return <p>You do not have permission to annotate photos.</p>;
  }
  let media;
  try {
    media = await getMedia(ctx, mediaId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  return (
    <div>
      <PageHeader title={`Annotate ${media.originalFilename}`} description={`Job ${id}`} />
      <AnnotationEditor mediaId={media.id} imageUrl={media.urls.original} />
    </div>
  );
}
