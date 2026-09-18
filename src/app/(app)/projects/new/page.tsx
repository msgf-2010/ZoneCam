import { requireAuth } from "@/server/auth/context";
import { ProjectEditor } from "@/components/editors";
import { PageHeader } from "@/components/ProjectRow";

export default async function NewProjectPage() {
  const ctx = await requireAuth();
  if (!ctx.permissions.has("projects.create")) {
    return <p>You do not have permission to create jobs.</p>;
  }
  return (
    <div>
      <PageHeader title="New job" description="Office and field staff will share this record." />
      <ProjectEditor />
    </div>
  );
}
