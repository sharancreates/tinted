import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Stretch to the container width — the default on mobile CTAs. */
  block?: boolean;
}

// min-h values keep every size at or above the 44px touch target WCAG 2.2 asks
// for, including "sm" — a small button is still a finger target.
const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "min-h-11 px-4 text-small",
  md: "min-h-12 px-6 text-small",
  lg: "min-h-14 px-8 text-body",
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  // Dark text on the accent in dark theme (6.45:1), and light text on the
  // accent in light theme (6.19:1) via text-bg. White on #c68642 is only
  // 3.05:1 and fails AA.
  primary:
    "bg-accent text-bg font-semibold hover:bg-accent-hover active:brightness-95",
  secondary:
    "bg-raised text-text border border-line-strong hover:border-accent hover:text-accent",
  ghost:
    "bg-transparent text-text-soft hover:bg-raised hover:text-text",
  danger:
    "bg-transparent text-danger border border-danger/40 hover:bg-danger/10",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      block = false,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-pill",
        "tracking-wide transition-all duration-(--duration-fast) ease-(--ease-out-soft)",
        "disabled:pointer-events-none disabled:opacity-40",
        sizes[size],
        variants[variant],
        block && "w-full",
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
