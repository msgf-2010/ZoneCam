import { requireAuth } from "@/server/auth/context";
import { FieldShell } from "@/components/field/FieldShell";

export const dynamic = "force-dynamic";

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();
  return (
    <FieldShell firstName={ctx.user.firstName} companyName={ctx.company.name}>
      {children}
    </FieldShell>
  );
}
