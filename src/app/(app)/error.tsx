"use client";

import { Button } from "@/components/ui/Button";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-2xl font-bold text-[var(--ink)]">Something went wrong</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">The page failed to load. Try again.</p>
      <Button className="mt-6" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
