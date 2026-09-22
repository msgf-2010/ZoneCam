"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { safeInternalPath } from "@/lib/safe-path";

function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8">
          <div className="text-xl font-bold text-[var(--ink)]">ZoneCam</div>
          <h1 className="mt-6 text-2xl font-bold text-[var(--ink)]">{title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(json.error ?? "Login failed.");
      return;
    }
    const role = json.data?.role?.key;
    const fieldClient = role === "field_technician" || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const next = safeInternalPath(search.get("next"), fieldClient ? "/field" : "/dashboard");
    router.push(next);
    router.refresh();
  }

  return (
    <AuthFrame title="Sign in" subtitle="Field crews document the job. The office sees it instantly.">
      <form onSubmit={onSubmit}>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </Field>
        <Field label="Password" error={error ?? undefined}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-4 flex justify-between text-sm text-[var(--muted)]">
        <Link href="/forgot-password">Forgot password</Link>
        <Link href="/login?next=/field">Field portal</Link>
        <Link href="/register" className="office-only">
          Create company
        </Link>
      </div>
    </AuthFrame>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    companyName: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await res.json().catch(() => null);
    setPending(false);
    if (!res.ok) {
      setError(payload?.error ?? "Could not create account. Try again after the latest deploy is Active.");
      return;
    }
    const fieldClient = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    router.push(fieldClient ? "/field" : "/dashboard");
    router.refresh();
  }

  return (
    <AuthFrame title="Create your company" subtitle="You will be the owner. Invite the rest of the team after you sign in.">
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          </Field>
          <Field label="Last name">
            <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </Field>
        </div>
        <Field label="Work email">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Password">
          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={10} />
        </Field>
        <Field label="Company name" error={error ?? undefined}>
          <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Already have access? <Link href="/login">Sign in</Link>
      </p>
    </AuthFrame>
  );
}
