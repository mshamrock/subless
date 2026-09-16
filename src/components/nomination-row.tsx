"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ChevronUp, ExternalLink } from "lucide-react";
import { toggleNominationVote } from "@/lib/actions/nominations";
import { TargetIcon } from "./target-icon";
import { cn, formatYearly, plural } from "@/lib/utils";

export interface NominationData {
  id: number;
  targetName: string;
  targetUrl: string | null;
  targetLogo?: string | null;
  pitch: string;
  monthlyPriceUsd: number | null;
  votes: number;
  authorLogin: string | null;
  authorName?: string | null;
  authorImage?: string | null;
}

export function NominationRow({
  nomination,
  voted,
  rank,
  compact = false,
}: {
  nomination: NominationData;
  voted: boolean;
  rank?: number;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setOptimistic] = useOptimistic(
    { votes: nomination.votes, voted },
    (prev) => ({ votes: prev.votes + (prev.voted ? -1 : 1), voted: !prev.voted }),
  );

  return (
    <article className="card card-hover flex items-start gap-4 p-4">
      {rank !== undefined && (
        <div className="mono w-6 shrink-0 pt-1.5 text-lg font-bold text-[var(--color-faint)]">
          {rank}
        </div>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            setOptimistic(null);
            const res = await toggleNominationVote(nomination.id);
            if (!res.ok) setError(res.error);
          })
        }
        className={cn(
          "flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 transition-colors",
          state.voted
            ? "border-[var(--color-acid-dim)] bg-[var(--color-acid)]/10 text-[var(--color-acid)]"
            : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]",
        )}
      >
        <ChevronUp size={16} />
        <span className="mono text-sm font-semibold">{state.votes}</span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <TargetIcon name={nomination.targetName} logoUrl={nomination.targetLogo} size={18} />
          <h3 className="text-[15px] font-semibold">{nomination.targetName}</h3>
          {nomination.monthlyPriceUsd != null && (
            <span className="mono chip text-[var(--color-acid)]">
              {formatYearly(nomination.monthlyPriceUsd)}
            </span>
          )}
          {nomination.targetUrl && (
            <a
              href={nomination.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-faint)] hover:text-[var(--color-fg)]"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        {/* Demand is the headline here, not the vote widget: the brief measures
            a nomination by how many people want it, not by its score */}
        <p className="mono mt-1 text-xs text-[var(--color-acid-dim)]">
          {state.votes} {plural(state.votes, "person wants", "people want")} this replaced
        </p>

        <p className={cn("mt-1.5 text-sm text-[var(--color-muted)]", compact && "line-clamp-2")}>
          {nomination.pitch}
        </p>

        {nomination.authorLogin && !compact && (
          <p className="mono mt-2 text-xs text-[var(--color-faint)]">
            nominated by @{nomination.authorLogin}
          </p>
        )}

        {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    </article>
  );
}
