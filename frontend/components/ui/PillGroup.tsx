import { cn } from "@/lib/utils";

/** Classes for one pill in a toggle group: frosted when selected, clear otherwise. */
export function pillClass(selected: boolean, className?: string) {
  return cn(
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-pill border px-4 text-small font-medium",
    "transition-[background-color,box-shadow,color,border-color] duration-(--duration-fast) ease-(--ease-out-soft)",
    selected
      ? "border-line bg-raised font-semibold text-text shadow-card"
      : "border-line text-text-soft hover:bg-raised/60 hover:text-text",
    className,
  );
}
