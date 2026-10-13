import { cn } from "@/lib/utils";

/**
 * A build's own mark, or its initial until there is one.
 *
 * The image is ours: fetched once by the sync and served from this origin, so
 * drawing a list of builds never sends a visitor's request to GitHub. The
 * initial is for the gap between a build being listed and its first sync.
 */
export function ProjectIcon({
  slug,
  name,
  hasIcon,
  size = 40,
  className,
}: {
  slug: string;
  name: string;
  hasIcon?: boolean;
  size?: number;
  className?: string;
}) {
  const radius = Math.round(size * 0.22);

  if (hasIcon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/projects/${slug}/icon`}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        loading="lazy"
        className={cn("shrink-0 bg-[var(--color-surface-2)] object-cover", className)}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center border border-[var(--color-border)] bg-[var(--color-surface-2)] font-semibold text-[var(--color-muted)]",
        className,
      )}
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.42) }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
