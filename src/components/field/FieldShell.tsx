"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function FieldShell({
  firstName,
  companyName,
  children,
}: {
  firstName: string;
  companyName: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const onHome = pathname === "/field";

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="field-root">
      <header className="field-top">
        <Link href="/field" className="field-brand">
          <span>ZONECAM</span>
          <strong>Field</strong>
        </Link>
        <div className="field-top-actions">
          {!onHome ? (
            <Link href="/field" className="field-home-btn">
              Jobs home
            </Link>
          ) : null}
          <button type="button" className="field-ghost" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>
      <p className="field-hello">
        {firstName} · {companyName}
      </p>
      {children}
    </div>
  );
}
