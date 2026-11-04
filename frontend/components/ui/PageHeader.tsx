import { cn } from "@/lib/utils";

/**
 * The title block at the top of a screen: coral eyebrow, one large Playfair
 * title, a line of context, and optional actions. Every route uses it so the
 * title sits at the same size and distance from the top on every page.
 */
export function PageHeader({
  label,
  title,
  description,
  children,
  align = "left",
  className,
}: {
  label?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Actions or badges under the description. */
  children?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-10 flex flex-col gap-2",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {label && <p className="text-label uppercase text-accent">{label}</p>}
      <h1 className="text-[clamp(2.25rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-text">
        {title}
      </h1>
      {description && <p className="mt-1 max-w-prose text-text-soft">{description}</p>}
      {children && <div className="mt-3">{children}</div>}
    </header>
  );
}
