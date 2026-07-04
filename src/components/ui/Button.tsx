import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:opacity-90",
  outline:
    "border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-blue-50",
  ghost:
    "border border-[var(--color-line)] text-[var(--color-ink)] hover:bg-gray-50",
  danger: "bg-[var(--color-danger)] text-white hover:opacity-90",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

// Minimum 44px touch target on mobile (a11y guardrail) via min-h.
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold min-h-[44px] sm:min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
