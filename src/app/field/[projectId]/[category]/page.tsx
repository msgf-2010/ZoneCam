import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { loadScopedProject } from "@/server/tenancy/access";
import { listProjectMedia } from "@/server/services/media-service";
import { FIELD_PHOTO_CATEGORIES, isFieldPhotoCategory } from "@/lib/field-categories";
import { FieldCapture } from "@/components/field/FieldCapture";
import { AppError } from "@/server/http";

export const dynamic = "force-dynamic";

export default async function FieldCategoryPage({
  params,
}: {
  params: Promise<{ projectId: string; category: string }>;
}) {
  const { projectId, category } = await params;
  if (!isFieldPhotoCategory(category)) notFound();
  const ctx = await requireAuth();
  try {
    await loadScopedProject(ctx, projectId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const meta = FIELD_PHOTO_CATEGORIES.find((item) => item.key === category)!;
  const media = await listProjectMedia(ctx, projectId, { tag: category });

  return (
    <div className="field-stack">
      <div className="field-crumbs">
        <Link href="/field" className="field-back">
          Jobs home
        </Link>
        <span className="field-crumb-sep">/</span>
        <Link href={`/field/${projectId}`} className="field-back">
          Categories
        </Link>
      </div>
      <h1 className="field-title">{meta.name}</h1>
      <p className="field-lead">{meta.hint}</p>
      <FieldCapture projectId={projectId} category={category} existing={media.items} />
    </div>
  );
}
