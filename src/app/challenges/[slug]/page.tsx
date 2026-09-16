import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getContestBySlug,
  getContestEntries,
  getEntryShareCard,
  getMyTestReport,
  getTestSummary,
  getUserProjects,
  getUserVote,
} from "@/lib/queries";
import { canSubmitEntry, canVote } from "@/lib/cycle";
import { EntryVoteCard } from "@/components/entry-vote-card";
import { EntrySubmitForm } from "@/components/entry-submit-form";
import { EmptyState } from "@/components/empty-state";
import { SignInButton } from "@/components/auth-buttons";
import { TargetIcon } from "@/components/target-icon";
import { CommentThread } from "@/components/comment-thread";
import { TestPanel } from "@/components/test-panel";
import { EntryShare } from "@/components/entry-share";
import { formatYearly, timeLeft } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ entry?: string }>;
}): Promise<Metadata> {
  const [{ slug }, { entry: entryParam }] = await Promise.all([params, searchParams]);
  const contest = await getContestBySlug(slug);
  if (!contest) return { title: "Challenge not found" };

  // A shared link carries the entry in the query string rather than only in the
  // fragment: crawlers never receive a fragment, so #entry-12 alone would give
  // every build the same preview card as the challenge itself
  const shared = entryParam ? await getEntryShareCard(Number(entryParam)) : null;
  if (shared && shared.contestSlug === slug) {
    const price = shared.targetPrice != null ? formatYearly(shared.targetPrice) : null;
    const title = shared.targetName
      ? `${shared.projectName} replaces ${shared.targetName}`
      : shared.projectName;
    // The tagline is written as a card headline, so it may or may not end in
    // punctuation — and this is a sentence now
    const tagline = /[.!?]$/.test(shared.tagline.trim())
      ? shared.tagline.trim()
      : `${shared.tagline.trim()}.`;

    const description = [
      tagline,
      price ? `${price} you stop paying.` : null,
      "Vote for it in the Subless challenge.",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `/challenges/${slug}?entry=${shared.entryId}`,
        images: [{ url: `/api/og/entry/${shared.entryId}`, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [`/api/og/entry/${shared.entryId}`],
      },
    };
  }

  return { title: contest.title, description: contest.brief };
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

export default async function ContestPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ entry?: string }>;
}) {
  const [{ slug }, { entry: entryParam }] = await Promise.all([params, searchParams]);
  const [contest, session] = await Promise.all([getContestBySlug(slug), auth()]);
  if (!contest) notFound();

  const sharedEntryId = entryParam ? Number(entryParam) : null;

  const userId = session?.user?.id;
  const [entries, userVote, myProjects] = await Promise.all([
    getContestEntries(contest.id),
    userId ? getUserVote(contest.id, userId) : Promise.resolve(null),
    userId ? getUserProjects(userId) : Promise.resolve([]),
  ]);

  /**
   * Testing stays open after voting closes. The brief's order is Build → Test →
   * Use, and someone adopting a launched winner is exactly the person whose
   * report is worth having.
   */
  const testingOpen = contest.status !== "queued";

  const testData = await Promise.all(
    entries.map(async (entry) => ({
      entryId: entry.entryId,
      summary: await getTestSummary(entry.entryId, contest.requirements),
      mine: userId ? await getMyTestReport(entry.entryId, userId) : null,
    })),
  );
  const testByEntry = new Map(testData.map((t) => [t.entryId, t]));

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
          entries.map((entry) => {
            const isOwn = Boolean(userId) && myProjects.some((p) => p.id === entry.projectId);
            const test = testByEntry.get(entry.entryId);

            return (
              <div key={entry.entryId}>
                <EntryVoteCard
                  entry={entry}
                  contestId={contest.id}
                  votedEntryId={userVote}
                  canVote={votingOpen}
                  isOwn={isOwn}
                  showResult={showResults}
                  highlighted={sharedEntryId === entry.entryId}
                  share={
                    isOwn ? (
                      <EntryShare
                        entryId={entry.entryId}
                        challengeSlug={contest.slug}
                        projectName={entry.name}
                        targetName={contest.targetName}
                        yearly={
                          contest.targetPrice != null ? formatYearly(contest.targetPrice) : null
                        }
                      />
                    ) : null
                  }
                  footer={
                    test ? (
                      <TestPanel
                        entryId={entry.entryId}
                        requirements={contest.requirements}
                        summary={test.summary}
                        mine={test.mine}
                        canTest={testingOpen}
                        isOwn={isOwn}
                        signedIn={Boolean(userId)}
                      />
                    ) : null
                  }
                />
              </div>
            );
          })
        )}
      </section>

      <CommentThread
        subjectType="contest"
        subjectId={contest.id}
        prompt="Questions about the requirements, or feedback on the builds"
      />
    </div>
  );
}
