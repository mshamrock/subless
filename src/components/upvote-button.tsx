"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ChevronUp } from "lucide-react";
import { toggleUpvote } from "@/lib/actions/projects";
import { cn } from "@/lib/utils";
import { useAuthPrompt } from "./auth-prompt";

export function UpvoteButton({
  projectId,
  count,
  active,
  signedIn,
}: {
  projectId: number;
  count: number;
  active: boolean;
  signedIn: boolean;
}) {
  const { requireAuth } = useAuthPrompt();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setOptimistic] = useOptimistic(
    { count, active },
    (prev) => ({ count: prev.count + (prev.active ? -1 : 1), active: !prev.active }),
  );

  return (
    <div className="relative">
      <button
        type="button"
        disabled={pending}
        title={signedIn ? undefined : "Sign in with GitHub"}
        onClick={() => {
          if (!requireAuth("upvote this build")) return;
          start(async () => {
            setError(null);
            setOptimistic(null);
            const res = await toggleUpvote(projectId);
            if (!res.ok) setError(res.error);
          });
        }}
        className={cn(
          "flex w-12 flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 transition-colors",
          state.active
            ? "border-[var(--color-acid-dim)] bg-[var(--color-acid)]/10 text-[var(--color-acid)]"
            : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]",
        )}
      >
        <ChevronUp size={16} />
        <span className="mono text-xs font-semibold">{state.count}</span>
      </button>

      {error && (
        <p className="absolute left-0 top-full z-10 mt-1 w-48 rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-surface)] p-2 text-[11px] text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
