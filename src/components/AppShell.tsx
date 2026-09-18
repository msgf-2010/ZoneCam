"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { NotificationBell } from "@/components/NotificationBell";

const NAV = [
  { href: "/field", label: "Field" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/customers", label: "Customers" },
  { href: "/calendar", label: "Calendar" },
  { href: "/tasks", label: "Tasks" },
  { href: "/reports", label: "Reports" },
  { href: "/payments", label: "Payments" },
  { href: "/team", label: "Team" },
  { href: "/messages", label: "Messages" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
];

type Props = {
  children: React.ReactNode;
  companyName: string;
  userName: string;
  emailVerified: boolean;
};

export function AppShell({ children, companyName, userName, emailVerified }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="bg-[var(--sidebar)] text-[var(--sidebar-ink)]">
        <div className="px-5 py-5">
          <div className="text-xs uppercase tracking-[0.18em] text-white/50">ZoneCam</div>
          <div className="mt-2 text-lg font-semibold">{companyName}</div>
        </div>
        <nav className="px-2 pb-6">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "mb-0.5 block rounded-lg px-3 py-2 text-sm",
                  active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--bg-elevated)] px-4 py-3 lg:px-8">
          <div className="text-sm text-[var(--muted)]">{userName}</div>
          <form action="/search" className="hidden min-w-48 flex-1 px-4 sm:block lg:max-w-md">
            <input
              name="q"
              type="search"
              placeholder="Search jobs, people, photos"
              className="min-h-10 w-full rounded-[10px] border border-[var(--line)] bg-white px-3 text-sm"
            />
          </form>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button variant="secondary" onClick={logout}>
              Log out
            </Button>
          </div>
        </header>
        {!emailVerified ? (
          <div className="border-b border-[#ead8b0] bg-[#f8eed8] px-4 py-2 text-sm lg:px-8">
            Confirm your email to finish setting up this account.{" "}
            <button
              className="font-medium underline"
              onClick={() => fetch("/api/v1/auth/resend-verification", { method: "POST" })}
            >
              Resend link
            </button>
          </div>
        ) : null}
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
