import { cn } from "@/lib/utils";

/** Classes for one pill in a toggle group: frosted when selected, clear otherwise. */
export function pillClass(selected: boolean, className?: string) {
  return cn(
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-pill border px-4 text-small font-medium",
    "transition-[background-color,box-shadow,color,border-color] duration-(--duration-fast) ease-(--ease-out-soft)",
    selected
      ? "border-white bg-white font-semibold text-text shadow-card"
      : "border-white/80 text-text-soft hover:bg-white/50 hover:text-text",
    className,
  );
}
