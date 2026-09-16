/**
 * The brand mark, shared by the header and anywhere else it appears, so the site
 * and the favicon can never drift apart. Kept in sync with app/icon.svg by hand —
 * the two are three lines each, and importing an SVG through the bundler just to
 * avoid that would cost more than it saves.
 */
export function SublessMark({
  size = 32,
  tile = true,
  className,
}: {
  size?: number;
  /** Draw the dark rounded background; off when the mark sits on dark already. */
  tile?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Subless"
    >
      {tile && <rect width="32" height="32" rx="7" fill="var(--color-acid)" />}
      <path
        d="M 23.4 10.8 A 7.4 5.2 0 1 0 16 16 A 7.4 5.2 0 1 1 8.6 21.2"
        fill="none"
        stroke={tile ? "#0a0b0d" : "var(--color-acid)"}
        strokeWidth="4.6"
        strokeLinecap="butt"
      />
    </svg>
  );
}
