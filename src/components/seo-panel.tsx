"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Check, ExternalLink, EyeOff, Megaphone, Search } from "lucide-react";
import { getSeoAudit, updateTargetDescription } from "@/lib/actions/admin";
import { ActionMessage } from "./form-status";
import { cn, plural } from "@/lib/utils";
import type { ContestPrefill } from "./content-manager";
import type { ActionResult } from "@/lib/actions/guard";

type Audit = Awaited<ReturnType<typeof getSeoAudit>>;
type Row = Audit["rows"][number];

/**
 * The service pages, worst first.
 *
 * Deliberately not a dashboard of numbers. There is no Search Console here and
 * no analytics to plug in, so a chart of positions would be invented; what an
 * admin can actually act on is which page is missing what, and the box to write
 * the missing part in. Everything else on this screen would be decoration.
 */
export function SeoPanel({
  initial,
  onPromote,
}: {
  initial: Audit;
  /** Hands a service to the contest form, for the one gap this panel cannot
      close itself: a checklist belongs to a challenge, not to a service. */
  onPromote: (prefill: ContestPrefill) => void;
}) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState(initial.query);
  const [filter, setFilter] = useState<"todo" | "ready" | "all">("todo");
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  // Same as Manage content: searching must not reload the admin page under it
  useEffect(() => {
    if (query === data.query) return;
    const timer = setTimeout(() => {
      start(async () => setData(await getSeoAudit(query)));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, data.query]);

  function save(targetId: number, description: string) {
    start(async () => {
      const res = await updateTargetDescription(targetId, description);
      setMessage(res);
      if (res.ok) setData(await getSeoAudit(query));
    });
  }

  const rows =
    filter === "all"
      ? data.rows
      : filter === "ready"
        ? data.rows.filter((r) => r.ready)
        : data.rows.filter((r) => r.indexable && !r.ready);
  const todo = data.indexable - data.ready;
  const hidden = data.total - data.indexable;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="eyebrow">SEO · service pages</h2>
        <p className="mono text-xs text-[var(--color-faint)]">
          {data.indexable} of {data.total} in the index ·{" "}
          <span className="text-[var(--color-acid)]">{data.ready} with copy</span> · {hidden}{" "}
          held back as empty
        </p>
      </div>

      <p className="max-w-3xl text-sm text-[var(--color-muted)]">
        A <span className="mono text-xs">/alternatives/…</span> page enters the index once it has a
        build or a vote — the same test the sitemap and the page&apos;s own robots tag apply. Being
        in the index is not the same as being worth the click: that needs a description, plus a
        build or a challenge checklist. Indexed pages missing copy come first here, because they are
        already collecting impressions and wasting them.
      </p>

      <ActionMessage state={message} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a service"
            className="input w-full pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(
            [
              ["todo", `Indexed, thin · ${todo}`],
              ["ready", `Ready · ${data.ready}`],
              ["all", `All · ${data.total}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "chip",
                filter === key && "border-[var(--color-acid-dim)] text-[var(--color-acid)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="card p-5 text-sm text-[var(--color-muted)]">
          {filter === "todo"
            ? "Every indexed service page has copy and something to show. Nothing to fix here."
            : "No matches."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <SeoRow
              key={row.id}
              row={row}
              pending={pending}
              onSave={save}
              onPromote={onPromote}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SeoRow({
  row,
  pending,
  onSave,
  onPromote,
}: {
  row: Row;
  pending: boolean;
  onSave: (targetId: number, description: string) => void;
  onPromote: (prefill: ContestPrefill) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(row.description ?? "");

  // A save re-fetches the whole list, so the row arrives as a new object with
  // the stored text; without this the editor would keep showing the old draft
  useEffect(() => setDraft(row.description ?? ""), [row.description]);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{row.name}</span>
            {row.ready ? (
              <span className="chip border-[var(--color-acid-dim)]/40 text-[var(--color-acid)]">
                <Check size={12} /> ready
              </span>
            ) : (
              <>
                {!row.indexable && (
                  <span
                    className="chip text-[var(--color-voting)]"
                    title="No build and no votes, so the page is noindex and stays out of the sitemap"
                  >
                    <EyeOff size={12} /> not in the index
                  </span>
                )}
                {row.missing.map((m) => (
                  <span key={m} className="chip text-[var(--color-muted)]">
                    {m}
                  </span>
                ))}
              </>
            )}
          </div>
          <div className="mono mt-1.5 flex flex-wrap gap-3 text-xs text-[var(--color-faint)]">
            <Link
              href={`/alternatives/${row.slug}`}
              target="_blank"
              className="flex items-center gap-1 hover:text-[var(--color-fg)]"
            >
              /alternatives/{row.slug} <ExternalLink size={11} />
            </Link>
            <span>
              {row.builds} {plural(row.builds, "build", "builds")}
            </span>
            <span>
              {row.votes} {plural(row.votes, "vote", "votes")}
            </span>
            {row.categoryName && <span>{row.categoryName}</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {/* Without this the worklist has rows nobody can act on: the page is
              indexed, the copy is written, and the only thing left missing is a
              checklist — which is written when the service becomes a challenge */}
          {row.missing.includes("no checklist") && (
            <button
              type="button"
              disabled={pending}
              title="Fill the contest form with this service"
              onClick={() =>
                onPromote({
                  nominationId: 0,
                  title: `${row.name} alternative`,
                  targetId: row.id,
                  targetName: row.name,
                  targetUrl: null,
                  monthlyPriceUsd: null,
                  brief: row.description ?? "",
                })
              }
              style={{ borderColor: "color-mix(in oklab, var(--color-building) 45%, transparent)" }}
              className="chip whitespace-nowrap text-[var(--color-building)] disabled:opacity-40"
            >
              <Megaphone size={13} />
              Make it a challenge
            </button>
          )}
          <button type="button" onClick={() => setOpen((v) => !v)} className="btn-ghost">
            {open ? "Close" : row.description ? "Edit copy" : "Write copy"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <label className="eyebrow mb-2 block" htmlFor={`seo-${row.id}`}>
            What someone paying for {row.name} actually needs instead
          </label>
          <textarea
            id={`seo-${row.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className="input w-full"
            placeholder={`Why people pay for ${row.name}, which part of it they actually use, and what a replacement has to cover. This is the page's own paragraph and its meta description.`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || draft === (row.description ?? "")}
              onClick={() => onSave(row.id, draft)}
              className="btn-primary"
            >
              Save
            </button>
            <span className="mono text-xs text-[var(--color-faint)]">
              {draft.trim().length} characters
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
