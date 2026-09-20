import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { loadScopedProject } from "@/server/tenancy/access";
import { AppError } from "@/server/http";
import { FieldWalkthrough } from "@/components/field/FieldWalkthrough";

export const dynamic = "force-dynamic";

export default async function FieldWalkthroughPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await requireAuth();
  try {
    await loadScopedProject(ctx, projectId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="field-stack">
      <div className="field-crumbs">
        <Link href="/field" className="field-back">
          Jobs home
        </Link>
        <span className="field-crumb-sep">/</span>
        <Link href={`/field/${projectId}`} className="field-back">
          Job
        </Link>
      </div>
      <h1 className="field-title">Walkthrough</h1>
      <FieldWalkthrough projectId={projectId} />
    </div>
  );
}
