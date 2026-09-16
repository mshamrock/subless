"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Check, Github, Star, Trophy } from "lucide-react";
import { voteForEntry } from "@/lib/actions/contests";
import { cn, formatNumber, plural } from "@/lib/utils";
import { useAuthPrompt } from "./auth-prompt";
import { Avatar } from "./avatar";
import { TryButton } from "./try-button";

export interface EntryCardData {
  entryId: number;
  projectId: number;
  slug: string;
  name: string;
  tagline: string;
  note: string | null;
  repoUrl: string;
  homepageUrl: string | null;
  builtWith: string | null;
  authorLogin: string | null;
  authorName: string | null;
  authorImage: string | null;
  stars: number;
  votes: number;
  rank: number | null;
  finalVotes: number;
}

export function EntryVoteCard({
  entry,
  contestId,
  votedEntryId,
  canVote,
  isOwn,
  showResult = false,
  footer,
  highlighted = false,
  share,
}: {
  entry: EntryCardData;
  contestId: number;
  votedEntryId: number | null;
  /** Whether the contest is in its voting week — not whether anyone is signed
      in, which the dialog handles at the moment of the click. */
  canVote: boolean;
  isOwn: boolean;
  showResult?: boolean;
  /** Rendered full width under the card — the testing checklist lives here. */
  footer?: React.ReactNode;
  /** This is the entry the incoming shared link pointed at. */
  highlighted?: boolean;
  /** The share control, shown to whoever entered this build. */
  share?: React.ReactNode;
}) {
  const { requireAuth } = useAuthPrompt();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const voted = votedEntryId === entry.entryId;

  const [state, setOptimistic] = useOptimistic(
    { votes: entry.votes, voted },
    (prev) => ({ votes: prev.votes + (prev.voted ? -1 : 1), voted: !prev.voted }),
  );

  const isWinner = showResult && entry.rank === 1;

  return (
    <article
      id={`entry-${entry.entryId}`}
      // `card` sets its own border, so the highlight has to come from a style
      style={
        highlighted && !isWinner
          ? { borderColor: "color-mix(in oklab, var(--color-voting) 55%, transparent)" }
          : undefined
      }
      className={cn(
        // Same stretched-link approach as ProjectCard: the card navigates to the
        // project, while the vote button and the code/demo links stay above it
        "card card-hover group relative flex flex-wrap items-start gap-4 p-4 scroll-mt-24 sm:flex-nowrap",
        isWinner && "border-[var(--color-winner)]/40 bg-[var(--color-winner)]/[0.04]",
        // Someone who followed a shared link landed here to look at one build,
        // and a page of identical cards does not tell them which
        highlighted && !isWinner && "bg-[var(--color-voting)]/[0.05]",
      )}
    >
      {showResult && (
        <div className="mono flex w-10 shrink-0 flex-col items-center pt-1">
          {isWinner ? (
            <Trophy size={20} className="text-[var(--color-winner)]" />
          ) : (
            <span className="text-lg font-bold text-[var(--color-faint)]">{entry.rank}</span>
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/projects/${entry.slug}`}
            className="text-[15px] font-semibold after:absolute after:inset-0 after:content-[''] group-hover:text-[var(--color-acid)]"
          >
            {entry.name}
          </Link>
          {entry.authorLogin && (
            <span className="flex items-center gap-1.5">
              <Avatar
                src={entry.authorImage}
                name={entry.authorName ?? entry.authorLogin}
                size={18}
              />
              <span className="mono text-xs text-[var(--color-faint)]">@{entry.authorLogin}</span>
            </span>
          )}
          {entry.builtWith && <span className="chip">{entry.builtWith}</span>}
        </div>

        <p className="mt-1 text-sm text-[var(--color-muted)]">{entry.tagline}</p>

        {entry.note && (
          <p className="mt-2 border-l-2 border-[var(--color-border-strong)] pl-3 text-sm italic text-[var(--color-muted)]">
            {entry.note}
          </p>
        )}

        <div className="mono relative z-10 mt-3 flex items-center gap-4 text-xs text-[var(--color-faint)]">
          <span className="flex items-center gap-1">
            <Star size={12} /> {formatNumber(entry.stars)}
          </span>
          <a
            href={entry.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-[var(--color-fg)]"
          >
            <Github size={12} /> code
          </a>
          {entry.homepageUrl && (
            <TryButton
              projectId={entry.projectId}
              href={entry.homepageUrl}
              label="Try"
              variant="compact"
              className="py-1"
            />
          )}
        </div>

        {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}

        {share}

        {footer}
      </div>

      <div className="relative z-10 shrink-0">
        {showResult ? (
          <div className="mono rounded-lg border border-[var(--color-border)] px-4 py-2 text-center">
            <p className="text-lg font-bold">{entry.finalVotes}</p>
            <p className="text-[10px] text-[var(--color-faint)]">
              {plural(entry.finalVotes, "vote", "votes")}
            </p>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending || !canVote || isOwn}
            title={
              isOwn
                ? "You cannot vote for your own entry"
                : canVote
                  ? undefined
                  : "Voting is closed right now"
            }
            onClick={() => {
              if (!requireAuth(`vote for ${entry.name}`)) return;
              start(async () => {
                setError(null);
                setOptimistic(null);
                const res = await voteForEntry(contestId, entry.entryId);
                if (!res.ok) setError(res.error);
              });
            }}
            className={cn(
              "flex min-w-[88px] items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
              state.voted
                ? "border-[var(--color-voting)] bg-[var(--color-voting)]/15 text-[var(--color-voting)]"
                : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-voting)]/60",
              (!canVote || isOwn) && "cursor-not-allowed opacity-50",
            )}
          >
            {state.voted && <Check size={14} />}
            <span className="mono font-bold">{state.votes}</span>
            <span className="text-xs">
              {state.voted ? "yours" : plural(state.votes, "vote", "votes")}
            </span>
          </button>
        )}
      </div>
    </article>
  );
}
