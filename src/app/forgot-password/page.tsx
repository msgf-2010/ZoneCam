"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setDone(true);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">Reset password</h1>
      {done ? (
        <p className="mt-4 text-[var(--muted)]">If that email exists, a reset link was sent. In development it is printed in the server log.</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Button type="submit">Send reset link</Button>
        </form>
      )}
      <p className="mt-6 text-sm">
        <Link href="/login">Back to sign in</Link>
      </p>
    </div>
  );
}
