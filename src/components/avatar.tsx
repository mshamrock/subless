import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A person's avatar, served through Next's image optimizer so the request goes
 * to this origin rather than to GitHub's CDN — the same reasoning as product
 * icons. Falls back to a monogram when someone has no avatar, so rows never
 * collapse or show a broken image.
 */
const TILE_COLORS = [
  "#4dd4ff", "#c9f24d", "#ffb020", "#ff6b6b",
  "#a78bfa", "#7fd68a", "#ff8fc7", "#6ee7d7",
];

function tileColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TILE_COLORS[hash % TILE_COLORS.length];
}

export function Avatar({
  src,
  name,
  size = 32,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={cn(
          "shrink-0 rounded-full border border-[var(--color-border)] object-cover",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  const color = tileColor(name);
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.42)),
        background: `color-mix(in oklab, ${color} 22%, transparent)`,
        color,
      }}
    >
      {name.replace(/^@/, "").trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
