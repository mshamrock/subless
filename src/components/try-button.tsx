"use client";

import { ArrowUpRight } from "lucide-react";
import { trackClick } from "@/lib/actions/projects";
import { cn } from "@/lib/utils";

/**
 * "Try it" — the action most visitors actually came for. Someone comparing a
 * free alternative against something they pay for wants to open it, not read
 * its source, so this outranks the repository link wherever a live site exists.
 *
 * It is also where the click-through metric is recorded. The score has always
 * counted click-throughs; until this button existed nothing ever incremented
 * them, so that term sat at zero for every project.
 */
export function TryButton({
  projectId,
  href,
  label = "Try it",
  variant = "primary",
  className,
}: {
  projectId: number;
  href: string;
  label?: string;
  variant?: "primary" | "compact";
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      // Fire-and-forget: the link opens in a new tab, so this page stays alive
      // long enough for the action to finish, and a failed count never blocks it
      onClick={() => {
        void trackClick(projectId);
      }}
      className={cn(
        variant === "primary"
          ? "btn-primary"
          : "inline-flex items-center gap-1 rounded-lg border border-[var(--color-acid-dim)]/50 bg-[var(--color-acid)]/10 px-2.5 py-1.5 text-xs font-medium text-[var(--color-acid)] transition-colors hover:bg-[var(--color-acid)]/20",
        className,
      )}
    >
      {label}
      <ArrowUpRight size={variant === "primary" ? 16 : 13} />
    </a>
  );
}
