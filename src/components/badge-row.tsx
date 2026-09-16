import type { Badge } from "@/lib/badges";

const TONE: Record<Badge["tone"], string> = {
  acid: "border-[var(--color-acid-dim)]/45 bg-[var(--color-acid)]/10 text-[var(--color-acid)]",
  winner: "border-[var(--color-winner)]/45 bg-[var(--color-winner)]/10 text-[var(--color-winner)]",
  building: "border-[var(--color-building)]/45 bg-[var(--color-building)]/10 text-[var(--color-building)]",
  muted: "border-[var(--color-border-strong)] text-[var(--color-muted)]",
};

export function BadgeRow({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <li
          key={badge.id}
          title={badge.description}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE[badge.tone]}`}
        >
          {badge.label}
        </li>
      ))}
    </ul>
  );
}
