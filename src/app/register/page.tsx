import Link from "next/link";
import { RegisterForm } from "@/components/AuthForms";
import { openRegistrationEnabled } from "@/lib/env";

export default function RegisterPage() {
  if (!openRegistrationEnabled()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div className="text-xl font-bold text-[var(--ink)]">ZoneCam</div>
          <h1 className="mt-6 text-2xl font-bold text-[var(--ink)]">Invitation only</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            ZoneCam does not offer public signup. Ask your company admin to invite your email, open the link in that message, then sign in.
          </p>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Already invited? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }
  return <RegisterForm />;
}
