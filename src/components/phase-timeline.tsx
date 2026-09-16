import Link from "next/link";
import { Hammer, Vote, Trophy } from "lucide-react";
import { timeLeft } from "@/lib/utils";
import { TargetIcon } from "./target-icon";

interface Phase {
  key: "building" | "voting" | "finished";
  contest: {
    slug: string;
    title: string;
    endsAt: Date | null;
    votingStartsAt: Date | null;
    targetName?: string | null;
    targetLogo?: string | null;
  } | null;
}

const META = {
  building: {
    icon: Hammer,
    week: "Week 1",
    name: "Build",
    color: "var(--color-building)",
    hint: "Entries are open",
  },
  voting: {
    icon: Vote,
    week: "Week 2",
    name: "Vote",
    color: "var(--color-voting)",
    hint: "Picking the best one",
    },
  finished: {
    icon: Trophy,
    week: "Week 3",
    name: "Launch",
    color: "var(--color-winner)",
    hint: "Winner takes the homepage",
  },
} as const;

/**
 * The three pipeline phases side by side — the site's main explainer.
 * Five seconds should be enough to grasp that a contest runs three weeks, yet
 * something happens every week, because the phases overlap.
 */
export function PhaseTimeline({ phases }: { phases: Phase[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {phases.map(({ key, contest }) => {
        const meta = META[key];
        const Icon = meta.icon;
        const deadline = key === "building" ? contest?.votingStartsAt : contest?.endsAt;

        return (
          <div
            key={key}
            className="card relative overflow-hidden p-4"
            style={{ borderColor: contest ? `color-mix(in oklab, ${meta.color} 35%, transparent)` : undefined }}
          >
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{ background: contest ? meta.color : "transparent" }}
            />

            <div className="mb-3 flex items-center justify-between">
              <span className="eyebrow">{meta.week}</span>
              <Icon size={15} style={{ color: contest ? meta.color : "var(--color-faint)" }} />
            </div>

            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: meta.color }}>
                {meta.name}
              </span>
              {contest && key !== "finished" && (
                <span
                  className="live-dot h-1.5 w-1.5 rounded-full"
                  style={{ background: meta.color }}
                />
              )}
            </div>

            {contest ? (
              <>
                <Link
                  href={`/challenges/${contest.slug}`}
                  className="flex items-center gap-2 text-sm text-[var(--color-fg)] hover:underline"
                >
                  {contest.targetName && (
                    <TargetIcon
                      name={contest.targetName}
                      logoUrl={contest.targetLogo}
                      size={18}
                    />
                  )}
                  <span className="line-clamp-2">{contest.title}</span>
                </Link>
                {key !== "finished" && (
                  <p className="mono mt-2 text-xs text-[var(--color-muted)]">
                    {timeLeft(deadline)} left
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--color-faint)]">{meta.hint} — nothing here yet</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
