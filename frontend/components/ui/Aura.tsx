import { cn } from "@/lib/utils";

export type AuraVariant = "match" | "quiz" | "vanity" | "looks";

/**
 * A blurred blend of Monk skin tones and pastels. The art on Tinted's tiles is
 * made of the same colours the classifier measures, not stock imagery.
 * Pass `tones` (four hexes) to paint it from a specific reading instead.
 */
export function Aura({
  variant = "match",
  tones,
  className,
  children,
}: {
  variant?: AuraVariant;
  tones?: [string, string, string, string];
  className?: string;
  children?: React.ReactNode;
}) {
  const style = tones
    ? ({
        "--a0": tones[0],
        "--a1": tones[1],
        "--a2": tones[2],
        "--a3": tones[3],
        "--a4": tones[1],
      } as React.CSSProperties)
    : undefined;
  return (
    <div
      className={cn("aura rounded-tile border-4 border-line", !tones && `aura-${variant}`, className)}
      style={style}
    >
      {children}
    </div>
  );
}
