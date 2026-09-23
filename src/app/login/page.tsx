import { Suspense } from "react";
import { LoginForm } from "@/components/AuthForms";
import { openRegistrationEnabled } from "@/lib/env";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm allowRegistration={openRegistrationEnabled()} />
    </Suspense>
  );
}
