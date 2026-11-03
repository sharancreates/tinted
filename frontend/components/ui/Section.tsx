import { cn } from "@/lib/utils";

/**
 * A titled page section.
 *
 * Exists because every block was hand-rolling its own heading markup and
 * margins, so the vertical rhythm drifted between them and headings sat at
 * three different sizes. One component means one rhythm.
 */
export function Section({
  label,
  title,
  aside,
  description,
  children,
  className,
  id,
}: {
  /** Small uppercase eyebrow above the title. */
  label?: string;
  title: string;
  /** Right-aligned secondary content on the title row — counts, controls. */
  aside?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <section
      aria-labelledby={headingId}
      className={cn("mt-(--space-section) first:mt-0", className)}
    >
      <div className="mb-(--space-block) flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          {label && <p className="text-label uppercase text-text-muted">{label}</p>}
          <h2
            id={headingId}
            className="text-heading font-semibold text-text"
          >
            {title}
          </h2>
        </div>
        {aside && <div className="shrink-0 text-small text-text-muted">{aside}</div>}
      </div>

      {description && (
        <p className="-mt-2 mb-(--space-block) max-w-prose text-small text-text-soft">
          {description}
        </p>
      )}

      {children}
    </section>
  );
}
