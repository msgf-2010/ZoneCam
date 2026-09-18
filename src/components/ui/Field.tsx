import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--brand)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[96px] w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--brand)]",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
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
