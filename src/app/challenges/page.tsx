import Link from "next/link";
import type { Metadata } from "next";
import { getContestList } from "@/lib/queries";
import { getWeeklyState } from "@/lib/cycle";
import { PhaseTimeline } from "@/components/phase-timeline";
import { EmptyState } from "@/components/empty-state";
import { TargetIcon } from "@/components/target-icon";
import { Hammer } from "lucide-react";
import { formatDate, timeLeft } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Challenges",
  description:
    "Each week the community builds a free alternative to one paid subscription.",
};
export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; color: string }> = {
  queued: { label: "queued", color: "var(--color-faint)" },
  building: { label: "build week", color: "var(--color-building)" },
  voting: { label: "voting open", color: "var(--color-voting)" },
  finished: { label: "launched", color: "var(--color-winner)" },
  archived: { label: "archived", color: "var(--color-faint)" },
};

export default async function ContestsPage() {
  const [contests, state] = await Promise.all([getContestList(), getWeeklyState()]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight">Subless Challenges</h1>
        <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
          Challenges are the heartbeat. Each runs three weeks — build, vote, launch — but
          the phases overlap, so something happens every single week.
        </p>
      </header>

      {state.building && (
        <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <Hammer size={18} className="text-[var(--color-building)]" />
            <div>
              <p className="text-sm font-semibold">Built something for {state.building.title}?</p>
              <p className="text-sm text-[var(--color-muted)]">
                Publishing it enters the challenge in one step.
              </p>
            </div>
          </div>
          <Link href={`/submit?challenge=${state.building.slug}`} className="btn-primary">
            Publish a build
          </Link>
        </div>
      )}

      <PhaseTimeline
        phases={[
          { key: "building", contest: state.building ?? null },
          { key: "voting", contest: state.voting ?? null },
          { key: "finished", contest: state.finished ?? null },
        ]}
      />

      {contests.length === 0 ? (
        <EmptyState title="No challenges yet" />
      ) : (
        <section className="space-y-3">
          <h2 className="eyebrow">All challenges</h2>
          {contests.map((c) => {
            const meta = STATUS_META[c.status] ?? STATUS_META.archived;
            return (
              <Link
                key={c.id}
                href={`/challenges/${c.slug}`}
                className="card card-hover block p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="mono text-xs uppercase tracking-wider"
                        style={{ color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {c.targetName && (
                        <span className="chip">
                          <TargetIcon name={c.targetName} logoUrl={c.targetLogo} size={14} />
                          {c.targetName}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 text-lg font-semibold">{c.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">{c.brief}</p>
                  </div>

                  <div className="mono shrink-0 text-right text-xs text-[var(--color-faint)]">
                    <p>
                      {c.entryCount} {c.entryCount === 1 ? "entry" : "entries"}
                    </p>
                    <p className="mt-1">
                      {c.status === "voting" && c.endsAt
                        ? `${timeLeft(c.endsAt)} left`
                        : c.buildingStartsAt
                          ? formatDate(c.buildingStartsAt)
                          : "not scheduled"}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
