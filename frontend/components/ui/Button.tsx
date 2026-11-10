import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Stretch to the container width. */
  block?: boolean;
}

// Every size stays at or above a 44px touch target.
const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "min-h-11 px-4 text-small",
  md: "min-h-12 px-6 text-small",
  lg: "min-h-14 px-8 text-body",
};

// Primary is ink with an inverted label (14.2:1 in light, 17.9:1 in dark).
// Coral stays an accent, never a button fill, so it keeps meaning "active" everywhere else.
const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-text text-bg shadow-card hover:-translate-y-px hover:shadow-lift active:translate-y-0",
  secondary:
    "glass-strong text-text hover:-translate-y-px hover:shadow-lift active:translate-y-0",
  ghost: "bg-transparent text-text-soft hover:bg-raised hover:text-text",
  danger: "bg-transparent text-danger border border-danger/40 hover:bg-danger/10",
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
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-pill font-semibold",
        "transition-[transform,box-shadow,background-color,color] duration-(--duration-fast) ease-(--ease-out-soft)",
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
