import { cn } from "@/lib/utils";

/**
 * A colour chip with its name.
 *
 * The name is never optional. A swatch alone encodes meaning in colour, which
 * fails WCAG 1.4.1 and is useless to anyone matching shades by description.
 */
export function ShadeSwatch({
  hex,
  name,
  detail,
  size = "md",
  selected = false,
  onSelect,
  className,
}: {
  hex: string;
  name: string;
  detail?: string;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const dot = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  }[size];

  const content = (
    <>
      <span
        className={cn(
          "shrink-0 rounded-full border border-line-strong",
          dot,
          selected && "ring-2 ring-accent-vivid ring-offset-2 ring-offset-white",
        )}
        style={{ backgroundColor: hex }}
        aria-hidden="true"
      />
      <span className="min-w-0 text-left">
        <span className="block truncate font-medium text-text">{name}</span>
        {detail && (
          <span className="block truncate text-small text-text-muted">
            {detail}
          </span>
        )}
        <span className="block text-label uppercase tabular-nums text-text-muted">
          {hex}
        </span>
      </span>
    </>
  );

  if (!onSelect) {
    return (
      <div className={cn("flex items-center gap-3", className)}>{content}</div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-card border p-2 text-left",
        "transition-[background-color,border-color] duration-(--duration-fast) ease-(--ease-out-soft)",
        selected
          ? "border-accent-vivid bg-accent-dim"
          : "border-transparent hover:bg-raised",
        className,
      )}
    >
      {content}
    </button>
  );
}
