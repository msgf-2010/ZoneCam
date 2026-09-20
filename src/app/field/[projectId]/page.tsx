import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { getProject } from "@/server/services/project-service";
import { countProjectMediaByTag } from "@/server/services/media-service";
import { AppError } from "@/server/http";
import { FIELD_PHOTO_CATEGORIES } from "@/lib/field-categories";
import { directionsUrl, formatAddress } from "@/lib/format";
import { FieldJobActions } from "@/components/field/FieldJobActions";
import { FieldMessage } from "@/components/field/FieldMessage";
import { listProjectMessages } from "@/server/services/message-service";
import { signedMediaPath } from "@/server/adapters/storage";

export const dynamic = "force-dynamic";

export default async function FieldJobPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await requireAuth();
  let project;
  try {
    project = await getProject(ctx, projectId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const [counts, messages] = await Promise.all([
    Promise.all(
      FIELD_PHOTO_CATEGORIES.map(async (category) => {
        const count = await countProjectMediaByTag(ctx, projectId, category.key);
        return { key: category.key, count };
      }),
    ),
    listProjectMessages(ctx, projectId),
  ]);
  const byKey = Object.fromEntries(counts.map((row) => [row.key, row.count]));
  const address = formatAddress(project);
  const directions = directionsUrl({ latitude: project.latitude, longitude: project.longitude, address });

  return (
    <div className="field-stack">
      <Link href="/field" className="field-back">
        Jobs home
      </Link>
      <h1 className="field-title">{project.name}</h1>
      <p className="field-lead">
        {project.number}
        {address ? ` · ${address}` : ""}
      </p>
      {project.media.length > 0 ? (
        <div className="field-job-photos field-job-photos-detail">
          {project.media.map((item) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={item.id} src={signedMediaPath(item.id, "thumbnail")} alt={item.originalFilename} />
          ))}
        </div>
      ) : (
        <p className="field-empty">No photos on this job yet. Pick a category below.</p>
      )}
      <FieldJobActions
        projectId={project.id}
        statusKey={project.projectStatus.key}
        canRun={ctx.permissions.has("projects.edit") || ctx.role.key === "field_technician"}
        directions={directions}
      />
      <Link href={`/field/${project.id}/walkthrough`} className="field-walk-cta">
        <span className="field-walk-cta-kicker">Office checklist</span>
        <span className="field-walk-cta-title">Video walkthrough</span>
        <span className="field-walk-cta-hint">Record video + voice. AI builds a trade list with screenshots.</span>
      </Link>
      <FieldMessage
        projectId={project.id}
        currentUserId={ctx.user.id}
        initial={messages.map((row) => ({
          id: row.id,
          body: row.body,
          createdAt: row.createdAt.toISOString(),
          authorId: row.authorId,
          author: row.author,
        }))}
      />
      <h2 className="field-sub">What are you documenting?</h2>
      <div className="field-cats">
        {FIELD_PHOTO_CATEGORIES.map((category) => (
          <Link key={category.key} href={`/field/${project.id}/${category.key}`} className="field-cat">
            <span className="field-cat-dot" style={{ background: category.tone }} />
            <span className="field-cat-name">{category.name}</span>
            <span className="field-cat-hint">{category.hint}</span>
            <span className="field-cat-count">{byKey[category.key] ?? 0}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
