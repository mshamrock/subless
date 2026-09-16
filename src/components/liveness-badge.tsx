import { livenessLabel } from "@/lib/score";
import { cn } from "@/lib/utils";

const TONE = {
  good: "text-[#7fd68a] border-[#7fd68a]/30 bg-[#7fd68a]/10",
  warn: "text-[var(--color-voting)] border-[var(--color-voting)]/30 bg-[var(--color-voting)]/10",
  bad: "text-[var(--color-danger)] border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10",
  unknown: "text-[var(--color-faint)] border-[var(--color-border)]",
} as const;

/**
 * Liveness goes straight on the card rather than hiding in the details.
 * An abandoned repo is the main way to get burned browsing a vibe-coded
 * directory: half of these projects are dead a month after launch.
 */
export function LivenessBadge({ pushedAt }: { pushedAt: Date | null }) {
  const days = pushedAt
    ? Math.round((Date.now() - new Date(pushedAt).getTime()) / 86_400_000)
    : null;
  const { label, tone } = livenessLabel(days);

  return (
    <span
      title={days === null ? "Metrics not synced yet" : `Last commit ${days} day(s) ago`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
        TONE[tone],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
