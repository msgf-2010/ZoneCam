import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border border-[#d4d4d4] bg-white px-3 py-2.5 outline-none transition-shadow focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("min-h-[96px]", control, className)} {...props} />;
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">
      {children}
    </label>
  );
}

export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="mb-4">
      <Label>{label}</Label>
      {children}
      {error ? <p className="mt-1 text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
