"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/guard";

export function SubmitButton({
  children,
  pendingLabel = "Submitting…",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn("btn-primary", className)}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function ActionMessage({ state }: { state: ActionResult<unknown> | null }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        state.ok
          ? "border-[var(--color-acid-dim)]/40 bg-[var(--color-acid)]/10 text-[var(--color-acid)]"
          : "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
      )}
    >
      {state.ok ? state.message ?? "Done" : state.error}
    </p>
  );
}
