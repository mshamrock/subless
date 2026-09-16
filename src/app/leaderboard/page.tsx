import Link from "next/link";
import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { getBuilderLeaderboard, getSiteStats } from "@/lib/queries";
import { computeBadges } from "@/lib/badges";
import { Avatar } from "@/components/avatar";
import { BadgeRow } from "@/components/badge-row";
import { EmptyState } from "@/components/empty-state";
import { formatMoneyCompact, plural } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Builders",
  description:
    "The people building free alternatives, ranked by the subscriptions their work has actually replaced.",
};
export const dynamic = "force-dynamic";

export default async function BuildersPage() {
  const [builders, stats] = await Promise.all([getBuilderLeaderboard(), getSiteStats()]);

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-3">Community</p>
        <h1 className="text-4xl font-bold tracking-tight">Builders</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--color-muted)]">
          The people making the alternatives. Ranked by what their work actually replaced —
          money people stopped paying, then challenges won, then the reach of what they
          published.
        </p>
        <p className="mono mt-4 text-sm text-[var(--color-faint)]">
          {builders.length} {plural(builders.length, "builder", "builders")} ·{" "}
          {stats.projects} {plural(stats.projects, "alternative", "alternatives")} published
        </p>
      </header>

      {builders.length === 0 ? (
        <EmptyState
          title="Nobody has published yet"
          hint="Be the first to put a free alternative in front of the community."
          action={<Link href="/submit" className="btn-primary">Publish a build</Link>}
        />
      ) : (
        <section className="space-y-3">
          {builders.map((b, i) => {
            const badges = computeBadges({
              projectCount: b.builds,
              winCount: b.wins,
              adoptions: b.adoptions,
              replacedAnnualUsd: b.adoptedAnnualUsd,
            });

            return (
              <Link
                key={b.id}
                href={`/builders/${b.login}`}
                className="card card-hover flex flex-wrap items-center gap-4 p-4"
              >
                <span className="mono w-7 shrink-0 text-lg font-bold text-[var(--color-faint)]">
                  {i + 1}
                </span>

                <Avatar src={b.image} name={b.name ?? b.login} size={44} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{b.name ?? b.login}</span>
                    <span className="mono text-xs text-[var(--color-faint)]">@{b.login}</span>
                    {b.wins > 0 && (
                      <span className="flex items-center gap-1 text-xs text-[var(--color-winner)]">
                        <Trophy size={12} />
                        {b.wins}
                      </span>
                    )}
                  </div>

                  <p className="mono mt-1 text-xs text-[var(--color-muted)]">
                    {b.builds} {plural(b.builds, "build", "builds")} · score{" "}
                    {b.totalScore.toFixed(1)}
                    {b.adoptions > 0 && (
                      <>
                        {" "}
                        · {b.adoptions} {plural(b.adoptions, "adopter", "adopters")}
                      </>
                    )}
                  </p>

                  {badges.length > 0 && (
                    <div className="mt-2">
                      <BadgeRow badges={badges} />
                    </div>
                  )}
                </div>

                {/* Real impact when there is any, otherwise what their work covers —
                    labelled differently so the two are never read as the same number */}
                <div className="mono shrink-0 text-right">
                  {b.adoptedAnnualUsd > 0 ? (
                    <>
                      <p className="text-lg font-bold text-[var(--color-acid)]">
                        {formatMoneyCompact(b.adoptedAnnualUsd)}/yr
                      </p>
                      <p className="text-[10px] text-[var(--color-faint)]">replaced</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-[var(--color-muted)]">
                        {formatMoneyCompact(b.coversAnnualUsd)}/yr
                      </p>
                      <p className="text-[10px] text-[var(--color-faint)]">could replace</p>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
