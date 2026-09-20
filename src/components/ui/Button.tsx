import { cn } from "@/lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  const styles = {
    primary: "bg-[var(--brand)] text-white hover:bg-[var(--brand-mild)]",
    secondary:
      "bg-white text-[var(--ink)] border border-[#d4d4d4] hover:border-[var(--brand)] hover:text-[var(--brand)] hover:ring-1 hover:ring-[var(--brand)]",
    ghost: "bg-transparent text-[var(--ink)] hover:bg-black/5 hover:text-[var(--brand)]",
    danger: "bg-[var(--danger)] text-white hover:opacity-90",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-5 py-2 font-bold outline-none transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    />
  );
}
