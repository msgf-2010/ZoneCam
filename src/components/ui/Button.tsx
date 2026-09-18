import { cn } from "@/lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  const styles = {
    primary: "bg-[var(--brand)] text-white hover:bg-[var(--brand-2)]",
    secondary: "bg-white text-[var(--ink)] border border-[var(--line)] hover:bg-[#faf7f1]",
    ghost: "bg-transparent text-[var(--ink)] hover:bg-black/5",
    danger: "bg-[var(--danger)] text-white",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 font-medium disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    />
  );
}
