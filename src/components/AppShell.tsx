"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { NotificationBell } from "@/components/NotificationBell";

const NAV_GROUPS = [
  {
    label: "Work",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/projects", label: "Projects" },
      { href: "/calendar", label: "Calendar" },
      { href: "/tasks", label: "Tasks" },
      { href: "/field", label: "Field" },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/customers", label: "Customers" },
      { href: "/reports", label: "Reports" },
      { href: "/payments", label: "Payments" },
      { href: "/messages", label: "Messages" },
    ],
  },
  {
    label: "Company",
    items: [
      { href: "/team", label: "Team" },
      { href: "/integrations", label: "Integrations" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

type Props = {
  children: React.ReactNode;
  companyName: string;
  userName: string;
  emailVerified: boolean;
};

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="px-3 pb-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-4">
          <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{group.label}</div>
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "mb-0.5 block rounded-xl px-3 py-2.5 text-sm font-semibold",
                  active
                    ? "bg-[var(--brand-subtle)] text-[var(--brand)]"
                    : "text-[var(--sidebar-ink)] hover:bg-[#f5f5f5]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children, companyName, userName, emailVerified }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] lg:flex">
      <aside className="sticky top-0 z-20 hidden h-screen w-[290px] shrink-0 border-r border-[var(--line)] bg-[var(--sidebar)] lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex h-16 items-center px-6">
          <span className="text-lg font-bold text-[var(--ink)]">ZoneCam</span>
        </Link>
        <div className="overflow-y-auto">
          <NavLinks pathname={pathname} />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-[280px] bg-white">
            <div className="flex h-16 items-center justify-between px-5">
              <span className="text-lg font-bold">ZoneCam</span>
              <button type="button" className="rounded-full p-2 hover:bg-black/5" onClick={() => setMobileOpen(false)}>
                Close
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 shadow-sm lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-full p-2 text-sm font-semibold hover:bg-black/5 lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              Menu
            </button>
            <div className="hidden truncate text-sm text-[var(--muted)] sm:block">{companyName}</div>
          </div>
          <form action="/search" className="hidden min-w-48 flex-1 px-4 sm:block lg:max-w-md">
            <input
              name="q"
              type="search"
              placeholder="Search..."
              className="h-10 w-full rounded-full border border-[var(--line)] bg-[#fafafa] px-4 text-sm outline-none focus:border-[var(--brand)] focus:bg-white focus:ring-1 focus:ring-[var(--brand)]"
            />
          </form>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <div className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-subtle)] text-xs font-bold text-[var(--brand)]">
              {initials || "U"}
            </div>
            <Button variant="ghost" className="hidden px-3 py-2 text-sm sm:inline-flex" onClick={logout}>
              Log out
            </Button>
          </div>
        </header>
        {!emailVerified ? (
          <div className="border-b border-[#ffd40045] bg-[#fffbeb] px-4 py-2 text-sm lg:px-8">
            Confirm your email to finish setting up this account.{" "}
            <button
              className="font-bold text-[var(--brand)]"
              onClick={() => fetch("/api/v1/auth/resend-verification", { method: "POST" })}
            >
              Resend link
            </button>
          </div>
        ) : null}
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
