import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { getContestBySlug, getContestEntries, getUserProjects, getUserVote } from "@/lib/queries";
import { canSubmitEntry, canVote } from "@/lib/cycle";
import { EntryVoteCard } from "@/components/entry-vote-card";
import { EntrySubmitForm } from "@/components/entry-submit-form";
import { EmptyState } from "@/components/empty-state";
import { SignInButton } from "@/components/auth-buttons";
import { TargetIcon } from "@/components/target-icon";
import { CommentThread } from "@/components/comment-thread";
import { formatYearly, timeLeft } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const contest = await getContestBySlug(slug);
  return contest
    ? { title: contest.title, description: contest.brief }
    : { title: "Challenge not found" };
}

const PHASE_COPY: Record<string, { label: string; color: string; note: string }> = {
  queued: {
    label: "Queued",
    color: "var(--color-faint)",
    note: "This challenge has not started — entries are not open yet.",
  },
  building: {
    label: "Build week",
    color: "var(--color-building)",
    note: "Entries are open. Voting starts when the week ends.",
  },
  voting: {
    label: "Voting open",
    color: "var(--color-voting)",
    note: "Entries are closed. One vote per person, and you can move it.",
  },
  finished: {
    label: "Launched",
    color: "var(--color-winner)",
    note: "This week's winner is on the homepage. You can go Subless on it now.",
  },
  archived: {
    label: "Archived",
    color: "var(--color-faint)",
    note: "This challenge is in the archive.",
  },
};

export default async function ContestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [contest, session] = await Promise.all([getContestBySlug(slug), auth()]);
  if (!contest) notFound();

  const userId = session?.user?.id;
  const [entries, userVote, myProjects] = await Promise.all([
    getContestEntries(contest.id),
    userId ? getUserVote(contest.id, userId) : Promise.resolve(null),
    userId ? getUserProjects(userId) : Promise.resolve([]),
  ]);

  const phase = PHASE_COPY[contest.status] ?? PHASE_COPY.archived;
  const showResults = contest.status === "finished" || contest.status === "archived";
  const votingOpen = canVote(contest.status);
  const submissionsOpen = canSubmitEntry(contest.status);
  const alreadySubmitted = new Set(entries.map((e) => e.projectId));

  return (
    <div className="space-y-8">
      <nav className="mono text-xs text-[var(--color-faint)]">
        <Link href="/challenges" className="hover:text-[var(--color-fg)]">challenges</Link>
        <span className="mx-2">/</span>
        <span>{contest.title}</span>
      </nav>

      <header
        className="card p-6 sm:p-8"
        style={{ borderColor: `color-mix(in oklab, ${phase.color} 35%, transparent)` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="mono text-xs uppercase tracking-[0.18em]"
                style={{ color: phase.color }}
              >
                {phase.label}
              </span>
              {contest.targetName && (
                <Link
                  href={contest.targetSlug ? `/alternatives/${contest.targetSlug}` : "/catalog"}
                  className="chip card-hover"
                >
                  <TargetIcon name={contest.targetName} logoUrl={contest.targetLogo} size={14} />
                  replacing {contest.targetName}
                  {contest.targetPrice ? (
                    <span className="mono text-[var(--color-acid)]">
                      {formatYearly(contest.targetPrice)}
                    </span>
                  ) : null}
                </Link>
              )}
              {contest.targetUrl && (
                <a
                  href={contest.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-faint)] hover:text-[var(--color-fg)]"
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </div>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{contest.title}</h1>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-[var(--color-muted)]">
              {contest.brief}
            </p>
            <p className="mt-3 text-sm text-[var(--color-faint)]">{phase.note}</p>
          </div>

          {(contest.status === "building" || contest.status === "voting") && (
            <div
              className="mono shrink-0 rounded-lg border px-5 py-4 text-center"
              style={{
                borderColor: `color-mix(in oklab, ${phase.color} 30%, transparent)`,
                background: `color-mix(in oklab, ${phase.color} 6%, transparent)`,
              }}
            >
              <p className="text-xs text-[var(--color-muted)]">
                {contest.status === "building" ? "entries close in" : "voting closes in"}
              </p>
              <p className="mt-1 text-sm font-semibold" style={{ color: phase.color }}>
                {timeLeft(contest.status === "building" ? contest.votingStartsAt : contest.endsAt)}
              </p>
            </div>
          )}
        </div>

        {contest.requirements.length > 0 && (
          <div className="mt-6 border-t border-[var(--color-border)] pt-5">
            <h2 className="eyebrow mb-3">What the MVP must do</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {contest.requirements.map((req, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className="mono shrink-0" style={{ color: phase.color }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[var(--color-fg)]">{req}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      {submissionsOpen &&
        (userId ? (
          <EntrySubmitForm
            contestId={contest.id}
            challengeSlug={contest.slug}
            projects={myProjects.filter((p) => !alreadySubmitted.has(p.id))}
          />
        ) : (
          <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <p className="text-sm text-[var(--color-muted)]">
              Sign in with GitHub to join this challenge.
            </p>
            <SignInButton redirectTo={`/challenges/${contest.slug}`} />
          </div>
        ))}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow">
            {showResults ? "Results" : "Entries"} · {entries.length}
          </h2>
          {votingOpen && !userId && (
            <SignInButton
              label="Sign in to vote"
              redirectTo={`/challenges/${contest.slug}`}
            />
          )}
        </div>

        {entries.length === 0 ? (
          <EmptyState
            title="No entries yet"
            hint={
              submissionsOpen
                ? "Be the first — add a project to the catalog and enter it here."
                : "Nobody entered this challenge."
            }
            action={
              submissionsOpen ? (
                <Link href={`/submit?challenge=${contest.slug}`} className="btn-ghost">
                  Publish a build
                </Link>
              ) : undefined
            }
          />
        ) : (
          entries.map((entry) => (
            <EntryVoteCard
              key={entry.entryId}
              entry={entry}
              contestId={contest.id}
              votedEntryId={userVote}
              canVote={votingOpen && Boolean(userId)}
              isOwn={Boolean(userId) && myProjects.some((p) => p.id === entry.projectId)}
              showResult={showResults}
            />
          ))
        )}
      </section>

      <CommentThread
        subjectType="contest"
        subjectId={contest.id}
        returnTo={`/challenges/${contest.slug}`}
        prompt="Questions about the requirements, or feedback on the builds"
      />
    </div>
  );
}
