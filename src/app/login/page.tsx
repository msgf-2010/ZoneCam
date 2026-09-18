"use client";

import { Suspense } from "react";
import { LoginForm } from "@/components/AuthForms";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
