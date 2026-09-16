"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Scissors } from "lucide-react";
import { toggleSwitch } from "@/lib/actions/switches";
import { cn, formatYearly } from "@/lib/utils";
import { useAuthPrompt } from "./auth-prompt";

/**
 * The moment the whole product builds toward: someone confirms they stopped
 * paying. It is the only input to the North Star, so it deserves to look like a
 * decision rather than another upvote.
 */
export function GoSublessButton({
  targetId,
  targetName,
  monthlyPriceUsd,
  projectId,
  active,
  signedIn,
  size = "default",
}: {
  targetId: number;
  targetName: string;
  monthlyPriceUsd: number | null;
  projectId?: number;
  active: boolean;
  signedIn: boolean;
  size?: "default" | "compact";
}) {
  const { requireAuth } = useAuthPrompt();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setOptimistic] = useOptimistic(active, (prev) => !prev);

  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={pending}
        title={signedIn ? undefined : "Sign in with GitHub"}
        onClick={() => {
          if (!requireAuth(`record that you went Subless on ${targetName}`)) return;
          start(async () => {
            setError(null);
            setOptimistic(null);
            const res = await toggleSwitch(targetId, projectId);
            if (!res.ok) setError(res.error);
          });
        }}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg font-medium transition-colors",
          size === "compact" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
          state
            ? "border border-[var(--color-acid-dim)] bg-[var(--color-acid)]/15 text-[var(--color-acid)]"
            : "bg-[var(--color-acid)] text-[#0a0b0d] hover:bg-[#d7ff63]",
          pending && "opacity-60",
        )}
      >
        {state ? <Check size={15} /> : <Scissors size={15} />}
        {state ? `You went Subless on ${targetName}` : `I went Subless on ${targetName}`}
      </button>

      {!state && monthlyPriceUsd != null && (
        <p className="mono mt-1.5 text-xs text-[var(--color-faint)]">
          counts {formatYearly(monthlyPriceUsd)} toward what the community has replaced
        </p>
      )}

      {error && <p className="mt-1.5 text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
