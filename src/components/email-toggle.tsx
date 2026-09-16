"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setEmailOptIn } from "@/lib/actions/settings";
import { cn } from "@/lib/utils";

export function EmailToggle({ initial, address }: { initial: boolean; address: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [on, setOptimistic] = useOptimistic(initial, (prev) => !prev);

  return (
    <div>
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <span className="min-w-0">
          <span className="block text-sm font-medium">Send me emails</span>
          <span className="mono block truncate text-xs text-[var(--color-faint)]">
            {address}
          </span>
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Send me emails"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              setOptimistic(null);
              const res = await setEmailOptIn(!on);
              if (!res.ok) setError(res.error);
            })
          }
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            on ? "bg-[var(--color-acid)]" : "bg-[var(--color-border-strong)]",
            pending && "opacity-60",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-[#0a0b0d] transition-transform",
              on ? "translate-x-[22px]" : "translate-x-0.5",
            )}
          />
        </button>
      </label>

      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}

      {!on && (
        <p className="mt-3 text-xs leading-relaxed text-[var(--color-faint)]">
          Emails are off. Everything still appears in the bell when you visit the site.
        </p>
      )}
    </div>
  );
}
