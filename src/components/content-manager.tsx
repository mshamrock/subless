"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Eye, EyeOff, Github, Megaphone, Plus, Search, Trash2, X } from "lucide-react";
import {
  addNominationAsAdmin,
  addProjectAsAdmin,
  deleteNomination,
  deleteProject,
  projectDeletionImpact,
  setNominationStatus,
  setProjectStatus,
} from "@/lib/actions/moderation";
import { getManagedContent } from "@/lib/actions/admin";
import { ActionMessage } from "./form-status";
import { cn, formatYearly, plural } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/guard";

type Managed = Awaited<ReturnType<typeof getManagedContent>>;

/**
 * Everything the contest form can fill in for itself when a nomination becomes
 * a challenge. Deliberately not the requirements: the checklist is the one part
 * a person has to write, and it is what testers and voters later judge against.
 */
export interface ContestPrefill {
  nominationId: number;
  title: string;
  targetId: number | null;
  targetName: string;
  targetUrl: string | null;
  monthlyPriceUsd: number | null;
  brief: string;
}

const STATUS_STYLE: Record<string, string> = {
  approved: "text-[var(--color-acid)] border-[var(--color-acid-dim)]/40",
  pending: "text-[var(--color-voting)] border-[var(--color-voting)]/40",
  hidden: "text-[var(--color-muted)] border-[var(--color-border-strong)]",
  rejected: "text-[var(--color-danger)] border-[var(--color-danger)]/40",
  promoted: "text-[var(--color-building)] border-[var(--color-building)]/40",
};

export function ContentManager({
  initial,
  targets,
  onPromote,
}: {
  initial: Managed;
  /** Real service ids. Nomination ids are a different key entirely — linking a
      project by the wrong one silently attaches it to the wrong subscription. */
  targets: { id: number; name: string }[];
  /** Hands a nomination to the contest form above. */
  onPromote: (prefill: ContestPrefill) => void;
}) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState(initial.query);
  const [tab, setTab] = useState<"nominations" | "alternatives">("nominations");
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);

  // Search lives here rather than in the URL: this is a working screen, and
  // reloading the whole admin page on every keystroke would lose the rest of it
  useEffect(() => {
    if (query === data.query) return;
    const timer = setTimeout(() => {
      start(async () => setData(await getManagedContent(query)));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, data.query]);

  function run(fn: () => Promise<ActionResult>) {
    start(async () => {
      const res = await fn();
      setMessage(res);
      if (res.ok) setData(await getManagedContent(query));
    });
  }

  const rows = tab === "nominations" ? data.nominations : data.projects;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="eyebrow">Manage content</h2>
        <div className="flex gap-1">
          {(["nominations", "alternatives"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "chip",
                tab === t && "border-[var(--color-acid-dim)] text-[var(--color-acid)]",
              )}
            >
              {t === "nominations"
                ? `Nominations · ${data.nominationTotal}`
                : `Alternatives · ${data.projectTotal}`}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="btn-ghost ml-auto"
        >
          {adding ? <X size={15} /> : <Plus size={15} />}
          {adding ? "Cancel" : `Add ${tab === "nominations" ? "nomination" : "alternative"}`}
        </button>
      </div>

      <ActionMessage state={message} />

      {adding &&
        (tab === "nominations" ? (
          <AddNomination onDone={() => { setAdding(false); run(async () => ({ ok: true })); }} />
        ) : (
          <AddAlternative
            targets={targets}
            onDone={() => { setAdding(false); run(async () => ({ ok: true })); }}
          />
        ))}

      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${tab}…`}
          aria-label={`Search ${tab}`}
          className="input py-2 pl-9 text-sm"
        />
      </div>

      {rows.length === 0 ? (
        <p className="card p-5 text-sm text-[var(--color-muted)]">Nothing matches.</p>
      ) : (
        <div className="space-y-2">
          {tab === "nominations"
            ? data.nominations.map((n) => (
                <div key={n.id} className="card flex flex-wrap items-center gap-3 p-4">
                  <span
                    className={cn(
                      "chip shrink-0 border",
                      STATUS_STYLE[n.status] ?? STATUS_STYLE.hidden,
                    )}
                  >
                    {n.status}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {n.targetName}
                      {n.monthlyPriceUsd != null && (
                        <span className="mono text-xs text-[var(--color-acid)]">
                          {formatYearly(n.monthlyPriceUsd)}
                        </span>
                      )}
                      <span className="mono text-xs text-[var(--color-faint)]">
                        {n.votes} {plural(n.votes, "vote", "votes")}
                      </span>
                    </p>
                    <p className="line-clamp-1 text-xs text-[var(--color-muted)]">{n.pitch}</p>
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    {n.status === "approved" && (
                      <IconButton
                        title="Make this the next challenge"
                        disabled={pending}
                        onClick={() =>
                          onPromote({
                            nominationId: n.id,
                            title: `${n.targetName} alternative`,
                            targetId: n.targetId,
                            targetName: n.targetName,
                            targetUrl: n.targetUrl,
                            monthlyPriceUsd: n.monthlyPriceUsd,
                            brief: n.pitch,
                          })
                        }
                      >
                        <Megaphone size={14} />
                      </IconButton>
                    )}
                    {n.status !== "approved" && (
                      <IconButton
                        title="Show"
                        disabled={pending}
                        onClick={() => run(() => setNominationStatus(n.id, "approved"))}
                      >
                        <Eye size={14} />
                      </IconButton>
                    )}
                    {n.status !== "hidden" && (
                      <IconButton
                        title="Hide"
                        disabled={pending}
                        onClick={() => run(() => setNominationStatus(n.id, "hidden"))}
                      >
                        <EyeOff size={14} />
                      </IconButton>
                    )}
                    <IconButton
                      title="Delete"
                      danger
                      disabled={pending}
                      onClick={() => {
                        if (
                          confirm(
                            `Delete "${n.targetName}" and its ${n.votes} ${plural(n.votes, "vote", "votes")}? This cannot be undone. Hiding keeps the record.`,
                          )
                        ) {
                          run(() => deleteNomination(n.id));
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              ))
            : data.projects.map((p) => (
                <div key={p.id} className="card flex flex-wrap items-center gap-3 p-4">
                  <span
                    className={cn(
                      "chip shrink-0 border",
                      STATUS_STYLE[p.status] ?? STATUS_STYLE.hidden,
                    )}
                  >
                    {p.status}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <Link href={`/projects/${p.slug}`} className="hover:text-[var(--color-acid)]">
                        {p.name}
                      </Link>
                      <span className="mono text-xs text-[var(--color-faint)]">★ {p.stars}</span>
                      {p.authorLogin && (
                        <span className="mono text-xs text-[var(--color-faint)]">
                          @{p.authorLogin}
                        </span>
                      )}
                    </p>
                    <p className="mono line-clamp-1 text-xs text-[var(--color-muted)]">
                      {p.repoFullName}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <IconButton title="Open repository" as="a" href={`https://github.com/${p.repoFullName}`}>
                      <Github size={14} />
                    </IconButton>
                    {p.status !== "approved" && (
                      <IconButton
                        title="Publish"
                        disabled={pending}
                        onClick={() => run(() => setProjectStatus(p.id, "approved"))}
                      >
                        <Eye size={14} />
                      </IconButton>
                    )}
                    {p.status !== "hidden" && (
                      <IconButton
                        title="Hide"
                        disabled={pending}
                        onClick={() => run(() => setProjectStatus(p.id, "hidden"))}
                      >
                        <EyeOff size={14} />
                      </IconButton>
                    )}
                    <IconButton
                      title="Delete"
                      danger
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          // Say out loud what disappears — a hard delete takes
                          // community work with it, and hiding is usually enough
                          const impact = await projectDeletionImpact(p.id);
                          const losses = [
                            impact.comments && `${impact.comments} comments`,
                            impact.challengeEntries && `${impact.challengeEntries} challenge entries`,
                            impact.upvotes && `${impact.upvotes} upvotes`,
                            impact.recordedSwitches &&
                              `${impact.recordedSwitches} recorded switches`,
                          ].filter(Boolean);

                          const detail = losses.length
                            ? `This also deletes ${losses.join(", ")}.`
                            : "Nothing else is attached to it.";

                          if (
                            confirm(
                              `Delete "${p.name}"? ${detail}\n\nThis cannot be undone. Hiding keeps everything.`,
                            )
                          ) {
                            const res = await deleteProject(p.id);
                            setMessage(res);
                            if (res.ok) setData(await getManagedContent(query));
                          }
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              ))}
        </div>
      )}

      {rows.length >= 60 && (
        <p className="text-xs text-[var(--color-faint)]">
          Showing the first 60. Search to narrow it down.
        </p>
      )}
    </section>
  );
}

function IconButton({
  children,
  title,
  danger,
  disabled,
  onClick,
  as,
  href,
}: {
  children: React.ReactNode;
  title: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  as?: "a";
  href?: string;
}) {
  const className = cn(
    "rounded-lg border border-[var(--color-border)] p-2 transition-colors",
    danger
      ? "text-[var(--color-faint)] hover:border-[var(--color-danger)]/50 hover:text-[var(--color-danger)]"
      : "text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]",
    disabled && "opacity-40",
  );

  if (as === "a") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={className}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

function AddNomination({ onDone }: { onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await addNominationAsAdmin(null, fd);
          if (res.ok) onDone();
          else setError(res.error);
        });
      }}
      className="card space-y-3 p-5"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
        <input name="targetName" required placeholder="Subscription name" className="input" />
        <input name="targetUrl" type="url" placeholder="https://…" className="input" />
        <input name="monthlyPriceUsd" type="number" min="0" step="0.01" placeholder="$ / month" className="input" />
      </div>
      <textarea
        name="pitch"
        required
        rows={2}
        placeholder="What a usable replacement actually needs"
        className="input resize-y"
      />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Adding…" : "Add nomination"}
      </button>
    </form>
  );
}

function AddAlternative({
  targets,
  onDone,
}: {
  targets: { id: number; name: string }[];
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await addProjectAsAdmin(null, fd);
          if (res.ok) onDone();
          else setError(res.error);
        });
      }}
      className="card space-y-3 p-5"
    >
      <input
        name="repoUrl"
        required
        placeholder="https://github.com/owner/repo"
        className="input"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" placeholder="Name (defaults to the repo name)" className="input" />
        <input name="tagline" placeholder="One line (defaults to the repo description)" className="input" />
      </div>
      <p className="text-xs text-[var(--color-faint)]">
        Which subscription does it replace? Pick at least one.
      </p>
      <select name="targetIds" required multiple size={5} className="input">
        {targets.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Checking the repository…" : "Add alternative"}
      </button>
    </form>
  );
}
