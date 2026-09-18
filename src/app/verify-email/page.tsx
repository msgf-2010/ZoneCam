"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState("Confirming your email…");

  useEffect(() => {
    if (!token) {
      setStatus("Missing verification token.");
      return;
    }
    fetch("/api/v1/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json();
          setStatus(json.error ?? "Verification failed.");
          return;
        }
        setStatus("Email verified. Redirecting…");
        setTimeout(() => router.push("/dashboard"), 800);
      })
      .catch(() => setStatus("Verification failed."));
  }, [token, router]);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">Email verification</h1>
      <p className="mt-4 text-[var(--muted)]">{status}</p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
