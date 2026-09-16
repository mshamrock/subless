"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Github, Loader2, Lock, Search, Star } from "lucide-react";
import { listMyRepositories, type RepoOption } from "@/lib/actions/projects";
import { cn, formatNumber } from "@/lib/utils";

/**
 * Pick a repository instead of typing its URL.
 *
 * Loaded on mount rather than behind a button: someone on this page is here to
 * publish something, and making them click to discover the shortcut defeats it.
 * A failure falls back silently to the manual field, which still works.
 */
export function RepoPicker({
  onPick,
  selected,
  challengeSlug,
}: {
  onPick: (repo: RepoOption | null) => void;
  selected: RepoOption | null;
  /** When publishing into a challenge, an already-published build of your own
      has somewhere better to go than a disabled row. */
  challengeSlug?: string;
}) {
  const [repos, setRepos] = useState<RepoOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let live = true;
    listMyRepositories().then((res) => {
      if (!live) return;
      if (res.ok) setRepos(res.repos);
      else setError(res.error);
    });
    return () => {
      live = false;
    };
  }, []);

  if (error) {
    return (
      <p className="text-xs text-[var(--color-faint)]">
        Could not read your repositories ({error}). Paste the URL below instead.
      </p>
    );
  }

  if (!repos) {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        <Loader2 size={14} className="animate-spin" />
        Reading your repositories…
      </p>
    );
  }

  if (repos.length === 0) {
    return (
      <p className="text-xs text-[var(--color-faint)]">
        No public repositories on your account yet. Paste a URL below instead.
      </p>
    );
  }

  if (selected) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-acid-dim)]/45 bg-[var(--color-acid)]/5 p-4">
        <Check size={16} className="text-[var(--color-acid)]" />
        <div className="min-w-0 flex-1">
          <p className="mono truncate text-sm font-medium">{selected.fullName}</p>
          {selected.description && (
            <p className="truncate text-xs text-[var(--color-muted)]">{selected.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onPick(null)}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          Change
        </button>
      </div>
    );
  }

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? repos.filter(
        (r) =>
          r.fullName.toLowerCase().includes(needle) ||
          (r.description ?? "").toLowerCase().includes(needle),
      )
    : repos;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]"
        />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Search your ${repos.length} repositories…`}
          aria-label="Search your repositories"
          className="input py-2 pl-9 text-sm"
        />
      </div>

      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {visible.map((repo) => {
          const body = (
            <>
              <Github size={14} className="shrink-0 text-[var(--color-faint)]" />

              <span className="min-w-0 flex-1">
                <span className="mono block truncate text-sm">{repo.fullName}</span>
                {repo.description && (
                  <span className="block truncate text-xs text-[var(--color-muted)]">
                    {repo.description}
                  </span>
                )}
              </span>

              <span className="mono flex shrink-0 items-center gap-2 text-xs text-[var(--color-faint)]">
                {repo.archived && <span title="Archived on GitHub">archived</span>}
                {repo.isFork && <span title="A fork">fork</span>}
                {repo.stars > 0 && (
                  <span className="flex items-center gap-1">
                    <Star size={11} /> {formatNumber(repo.stars)}
                  </span>
                )}
                {repo.listed?.mine ? (
                  <span className="flex items-center gap-1 text-[var(--color-acid)]">
                    {challengeSlug ? "enter this build" : "your build"}
                    <ArrowRight size={11} />
                  </span>
                ) : (
                  repo.alreadySubmitted && (
                    <span className="flex items-center gap-1" title="Published by someone else">
                      <Lock size={11} /> listed
                    </span>
                  )
                )}
              </span>
            </>
          );

          const shell =
            "flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-colors";

          // Your own published build is not a dead end — it is one click from
          // the challenge it should be entered into
          if (repo.listed?.mine) {
            return (
              <li key={repo.fullName}>
                <Link
                  href={challengeSlug ? `/challenges/${challengeSlug}` : `/projects/${repo.listed.slug}`}
                  className={cn(shell, "hover:border-[var(--color-acid-dim)] hover:bg-[var(--color-surface-2)]")}
                >
                  {body}
                </Link>
              </li>
            );
          }

          return (
            <li key={repo.fullName}>
              <button
                type="button"
                disabled={repo.alreadySubmitted}
                onClick={() => onPick(repo)}
                className={cn(
                  shell,
                  repo.alreadySubmitted
                    ? "cursor-not-allowed opacity-45"
                    : "hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]",
                )}
              >
                {body}
              </button>
            </li>
          );
        })}

        {visible.length === 0 && (
          <li className="px-3 py-2 text-sm text-[var(--color-faint)]">No matches</li>
        )}
      </ul>
    </div>
  );
}
