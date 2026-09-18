import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireAuth } from "@/server/auth/context";

export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch {
    redirect("/login");
  }
  return (
    <AppShell
      companyName={ctx.company.name}
      userName={`${ctx.user.firstName} ${ctx.user.lastName}`}
      emailVerified={Boolean(ctx.user.emailVerifiedAt)}
    >
      {children}
    </AppShell>
  );
}
