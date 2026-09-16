import Link from "next/link";
import { ArrowRight, Hammer, Trophy, Vote } from "lucide-react";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { projects } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { getWeeklyState } from "@/lib/cycle";
import {
  getCatalog,
  getContestEntries,
  getNominations,
  getSiteStats,
  getUserNominationVotes,
  getUserProjects,
  getUserUpvotes,
  getUserVote,
} from "@/lib/queries";
import { BRAND, goSublessOn } from "@/lib/brand";
import { PhaseTimeline } from "@/components/phase-timeline";
import { TargetIcon } from "@/components/target-icon";
import { ProjectCard } from "@/components/project-card";
import { EntryVoteCard } from "@/components/entry-vote-card";
import { NominationRow } from "@/components/nomination-row";
import { EmptyState } from "@/components/empty-state";
import { formatMoneyCompact, formatNumber, formatYearly, plural, timeLeft } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [{ building, voting, finished }, stats] = await Promise.all([
    getWeeklyState(),
    getSiteStats(),
  ]);

  const [votingEntries, userVote, winner, topNominations, topProjects, myProjects, myNominationVotes] =
    await Promise.all([
      voting ? getContestEntries(voting.id) : Promise.resolve([]),
      voting && userId ? getUserVote(voting.id, userId) : Promise.resolve(null),
      finished?.winnerProjectId ? loadWinner(finished.winnerProjectId) : Promise.resolve(null),
      getNominations("approved"),
      getCatalog({ sort: "score", limit: 5 }),
      userId ? getUserProjects(userId) : Promise.resolve([]),
      userId ? getUserNominationVotes(userId) : Promise.resolve(new Set<number>()),
    ]);

  const myUpvotes = userId ? await getUserUpvotes(userId) : new Set<number>();

  const myProjectIds = new Set(myProjects.map((p) => p.id));

  return (
    <div className="space-y-16">
      {/* ─────────  Hero (brief §8)  ───────── */}
      <section>
        <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          {BRAND.tagline}
        </h1>

        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--color-muted)]">
          Vote for the subscriptions you want replaced. Build free alternatives with the
          community.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/wanted" className="btn-primary">
            Explore alternatives <ArrowRight size={16} />
          </Link>
          <Link href="/submit" className="btn-ghost">
            Start building
          </Link>
        </div>

        <p className="mono mt-5 text-sm text-[var(--color-faint)]">{BRAND.promise}</p>

        {/* North Star (§13) gets the whole width; the rest are supporting metrics */}
        <div className="mt-10 card overflow-hidden">
          <div className="border-b border-[var(--color-border)] px-6 py-7">
            <p className="text-3xl font-bold tracking-tight text-[var(--color-acid)] sm:text-4xl">
              {formatMoneyCompact(stats.annualReplacedUsd)}/year
            </p>
            <p className="mt-1.5 text-sm text-[var(--color-muted)]">
              in subscriptions the community has actually stopped paying for
            </p>
            <p className="mono mt-3 text-xs text-[var(--color-faint)]">
              counted from {stats.switchCount}{" "}
              {plural(stats.switchCount, "recorded switch", "recorded switches")} ·{" "}
              {formatMoneyCompact(stats.annualAvailableUsd)}/year more already has a
              community alternative
            </p>
          </div>

          <dl className="mono grid grid-cols-2 gap-px bg-[var(--color-border)] sm:grid-cols-4">
            <Stat label="subscriptions nominated" value={formatNumber(stats.nominated)} />
            <Stat label="votes cast" value={formatNumber(stats.votesCast)} />
            <Stat label="alternatives launched" value={formatNumber(stats.projects)} />
            <Stat label="active builders" value={formatNumber(stats.builders)} />
          </dl>
        </div>
      </section>

      {/* ─────────  Pipeline  ───────── */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="eyebrow">{BRAND.mechanism}</h2>
          <Link href="/challenges" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            all challenges →
          </Link>
        </div>
        <PhaseTimeline
          phases={[
            { key: "building", contest: building ?? null },
            { key: "voting", contest: voting ?? null },
            { key: "finished", contest: finished ?? null },
          ]}
        />
      </section>

      {/* ─────────  Winner of the week  ───────── */}
      {winner && finished && (
        <section>
          <h2 className="eyebrow mb-4 flex items-center gap-2">
            <Trophy size={14} className="text-[var(--color-winner)]" />
            You can now go Subless
          </h2>

          <div
            className="card relative overflow-hidden p-6 sm:p-8"
            style={{ borderColor: "color-mix(in oklab, var(--color-winner) 40%, transparent)" }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                background:
                  "radial-gradient(40rem 20rem at 20% 0%, var(--color-winner), transparent 70%)",
              }}
            />
            <div className="relative">
              <p className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
                {finished.targetName && (
                  <TargetIcon
                    name={finished.targetName}
                    logoUrl={finished.targetLogo}
                    size={16}
                  />
                )}
                {finished.targetName
                  ? `${goSublessOn(finished.targetName)}.`
                  : `${finished.title} challenge`}
              </p>
              <h3 className="mt-2 text-3xl font-bold tracking-tight">{winner.name}</h3>
              <p className="mt-2 max-w-2xl text-[var(--color-muted)]">{winner.tagline}</p>
              {finished.targetPrice != null && (
                <p className="mono mt-3 text-sm text-[var(--color-acid)]">
                  {formatYearly(finished.targetPrice)} you stop paying
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/projects/${winner.slug}`} className="btn-primary">
                  View project
                </Link>
                <a
                  href={winner.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost"
                >
                  Repository
                </a>
                <Link href={`/challenges/${finished.slug}`} className="btn-ghost">
                  Challenge results
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─────────  Build week  ───────── */}
      <section>
        <h2 className="eyebrow mb-4 flex items-center gap-2">
          <Hammer size={14} className="text-[var(--color-building)]" />
          This week&apos;s Subless Challenge
        </h2>

        {building ? (
          <div className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
                  {building.targetName && (
                    <TargetIcon
                      name={building.targetName}
                      logoUrl={building.targetLogo}
                      size={28}
                    />
                  )}
                  {building.title}
                </h3>
                <p className="mt-2 whitespace-pre-line text-[var(--color-muted)]">
                  {building.brief}
                </p>

                {building.requirements.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {building.requirements.map((req, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-[var(--color-fg)]">
                        <span className="mono shrink-0 text-[var(--color-building)]">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {req}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mono shrink-0 rounded-lg border border-[var(--color-building)]/30 bg-[var(--color-building)]/5 px-4 py-3 text-center">
                <p className="text-xs text-[var(--color-muted)]">entries close in</p>
                <p className="mt-1 text-sm font-semibold text-[var(--color-building)]">
                  {timeLeft(building.votingStartsAt)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/challenges/${building.slug}`} className="btn-primary">
                Take part
              </Link>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No challenge announced for this week yet"
            hint="Nominate a subscription in the meantime — the strongest demand becomes the next challenge automatically."
            action={
              <Link href="/wanted" className="btn-ghost">
                Nominate a subscription
              </Link>
            }
          />
        )}
      </section>

      {/* ─────────  Voting  ───────── */}
      {voting && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="eyebrow flex items-center gap-2">
              <Vote size={14} className="text-[var(--color-voting)]" />
              Voting ·
              {voting.targetName && (
                <TargetIcon name={voting.targetName} logoUrl={voting.targetLogo} size={14} />
              )}
              {voting.title}
            </h2>
            <span className="mono text-xs text-[var(--color-muted)]">
              {timeLeft(voting.endsAt)} left
            </span>
          </div>

          {votingEntries.length === 0 ? (
            <EmptyState title="Nobody has entered this challenge yet" />
          ) : (
            <div className="space-y-3">
              {votingEntries.slice(0, 5).map((entry) => (
                <EntryVoteCard
                  key={entry.entryId}
                  entry={entry}
                  contestId={voting.id}
                  votedEntryId={userVote}
                  canVote={Boolean(userId)}
                  isOwn={myProjectIds.has(entry.projectId)}
                />
              ))}
              {votingEntries.length > 5 && (
                <Link
                  href={`/challenges/${voting.slug}`}
                  className="block py-2 text-center text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                >
                  {votingEntries.length - 5} more →
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {/* ─────────  Demand (brief §4, §11)  ───────── */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="eyebrow">Most wanted replacements</h2>
          <Link href="/wanted" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            all nominations →
          </Link>
        </div>

        {topNominations.length === 0 ? (
          <EmptyState
            title="Nobody has nominated a subscription yet"
            hint="What SaaS subscription do you hate paying for?"
            action={<Link href="/wanted" className="btn-ghost">Nominate</Link>}
          />
        ) : (
          <div className="space-y-2">
            {topNominations.slice(0, 5).map((n) => (
              <NominationRow
                key={n.id}
                nomination={n}
                voted={myNominationVotes.has(n.id)}
                compact
              />
            ))}
          </div>
        )}
      </section>

      {/* ─────────  Catalog highlights  ───────── */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="eyebrow">Already replaced</h2>
          <Link href="/leaderboard" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            all alternatives →
          </Link>
        </div>

        {topProjects.length === 0 ? (
          <EmptyState title="No alternatives published yet" />
        ) : (
          <div className="space-y-3">
            {topProjects.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                rank={i + 1}
                upvoted={myUpvotes.has(p.id)}
                signedIn={Boolean(userId)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-surface)] px-4 py-5">
      <dd className="text-2xl font-bold text-[var(--color-fg)]">{value}</dd>
      <dt className="mt-1 text-xs text-[var(--color-faint)]">{label}</dt>
    </div>
  );
}

async function loadWinner(projectId: number) {
  const [row] = await db
    .select({
      slug: projects.slug,
      name: projects.name,
      tagline: projects.tagline,
      repoUrl: projects.repoUrl,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row ?? null;
}
