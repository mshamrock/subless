"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Database,
  ListPlus,
  Github,
  Image,
  Mail,
  RefreshCw,
  SkipForward,
} from "lucide-react";
import {
  advanceCycle,
  createContest,
  fetchMissingIcons,
  previewWeeklyDigest,
  seedReference,
  seedCandidateSlate,
  moderateNomination,
  moderateProject,
  moveInQueue,
  syncMetricsNow,
} from "@/lib/actions/admin";
import { ActionMessage, SubmitButton } from "./form-status";
import { ContentManager, type ContestPrefill } from "./content-manager";
import { SeoPanel } from "./seo-panel";
import { TargetIcon } from "./target-icon";
import { formatDate, formatMoney, timeLeft } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/guard";

// Take the type straight from the server action: `import type` is erased at
// build time, so this client component never pulls the server module into the bundle
type AdminData = Awaited<ReturnType<typeof import("@/lib/actions/admin").getAdminData>>;

interface WeeklyState {
  building?: { slug: string; title: string; votingStartsAt: Date | null } | null;
  voting?: { slug: string; title: string; endsAt: Date | null } | null;
  finished?: { slug: string; title: string } | null;
}

type Managed = Awaited<ReturnType<typeof import("@/lib/actions/admin").getManagedContent>>;
type Seo = Awaited<ReturnType<typeof import("@/lib/actions/admin").getSeoAudit>>;

export function AdminPanel({
  data,
  state,
  managed,
  seo,
}: {
  data: AdminData;
  state: WeeklyState;
  managed: Managed;
  seo: Seo;
}) {
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [prefill, setPrefill] = useState<ContestPrefill | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<ActionResult>) {
    start(async () => setMessage(await fn()));
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Moderation, the contest queue, and manual control over the weekly cycle.
          </p>
        </div>
        {/* Six buttons in a row is wider than a phone; they wrap rather than
            dragging the whole admin screen sideways */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(syncMetricsNow)}
            className="btn-ghost"
          >
            <RefreshCw size={15} /> Sync metrics
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(seedReference)}
            title="Load categories, paid services and already-catalogued alternatives. Safe to run twice."
            className="btn-ghost"
          >
            <Database size={15} /> Seed reference data
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(seedCandidateSlate)}
            title="Load the starting slate of subscriptions worth replacing. Zero votes, no author. Safe to run twice."
            className="btn-ghost"
          >
            <ListPlus size={15} /> Load nomination candidates
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(fetchMissingIcons)}
            title="Fetch icons for services that have none, and register approved nominations"
            className="btn-ghost"
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image size={15} /> Fetch missing icons
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(previewWeeklyDigest)}
            title="Build and send this week's digest to opted-in members"
            className="btn-ghost"
          >
            <Mail size={15} /> Send weekly digest
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("Advance the cycle by one week? Voting closes and a winner is locked in.")) {
                run(advanceCycle);
              }
            }}
            className="btn-primary"
          >
            <SkipForward size={15} /> Advance cycle
          </button>
        </div>
      </header>

      <ActionMessage state={message} />

      {/* Current pipeline state */}
      <section className="grid gap-3 sm:grid-cols-3">
        <StateCard
          label="Building"
          title={state.building?.title}
          slug={state.building?.slug}
          sub={state.building ? `${timeLeft(state.building.votingStartsAt)} until voting` : undefined}
          color="var(--color-building)"
        />
        <StateCard
          label="Voting"
          title={state.voting?.title}
          slug={state.voting?.slug}
          sub={state.voting ? `${timeLeft(state.voting.endsAt)} left` : undefined}
          color="var(--color-voting)"
        />
        <StateCard
          label="On homepage"
          title={state.finished?.title}
          slug={state.finished?.slug}
          color="var(--color-winner)"
        />
      </section>

      <NewContestForm targets={data.targetList} prefill={prefill} onClear={() => setPrefill(null)} />

      {/* Above Manage content on purpose: that list renders sixty cards, and a
          worklist you have to scroll past them to reach is one nobody uses */}
      <SeoPanel initial={seo} onPromote={setPrefill} />

      <ContentManager initial={managed} targets={data.targetList} onPromote={setPrefill} />

      {/* Queue */}
      <section>
        <h2 className="eyebrow mb-3">Contest queue · {data.queue.length}</h2>
        {data.queue.length === 0 ? (
          <p className="card p-5 text-sm text-[var(--color-muted)]">
            The queue is empty. On the next cycle tick, the most-voted approved nomination
            automatically becomes the topic — with no requirements, since nobody wrote any. To
            choose the topic and its checklist yourself, hit{" "}
            <span className="text-[var(--color-building)]">Make it a challenge</span> on any
            nomination under Manage content.
          </p>
        ) : (
          <div className="space-y-2">
            {data.queue.map((c, i) => (
              <div key={c.id} className="card flex items-center gap-3 p-4">
                <span className="mono w-6 text-sm text-[var(--color-faint)]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/challenges/${c.slug}`} className="font-medium hover:text-[var(--color-acid)]">
                    {c.title}
                  </Link>
                  {c.targetName && (
                    <span className="chip ml-2">
                      <TargetIcon name={c.targetName} size={14} />
                      {c.targetName}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={pending || i === 0}
                    onClick={() => run(() => moveInQueue(c.id, -1))}
                    className="rounded border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] disabled:opacity-30 hover:text-[var(--color-fg)]"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={pending || i === data.queue.length - 1}
                    onClick={() => run(() => moveInQueue(c.id, 1))}
                    className="rounded border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] disabled:opacity-30 hover:text-[var(--color-fg)]"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Projects awaiting review */}
      <section>
        <h2 className="eyebrow mb-3">Projects in review · {data.pendingProjects.length}</h2>
        {data.pendingProjects.length === 0 ? (
          <p className="card p-5 text-sm text-[var(--color-muted)]">Nothing waiting.</p>
        ) : (
          <div className="space-y-3">
            {data.pendingProjects.map((p) => (
              <div key={p.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{p.name}</h3>
                      {p.ownershipVerified ? (
                        <span className="chip border-[var(--color-acid-dim)]/40 text-[var(--color-acid)]">
                          ownership verified
                        </span>
                      ) : (
                        <span className="chip border-[var(--color-voting)]/40 text-[var(--color-voting)]">
                          ownership unverified
                        </span>
                      )}
                      {p.builtWith && <span className="chip">{p.builtWith}</span>}
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{p.tagline}</p>
                    <div className="mono mt-2 flex flex-wrap gap-3 text-xs text-[var(--color-faint)]">
                      <a
                        href={p.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-[var(--color-fg)]"
                      >
                        <Github size={12} /> {p.repoUrl.replace("https://github.com/", "")}
                      </a>
                      <span>★ {p.stars}</span>
                      {p.authorLogin && <span>@{p.authorLogin}</span>}
                      <span>{formatDate(p.createdAt)}</span>
                    </div>
                    {p.syncError && (
                      <p className="mt-2 text-xs text-[var(--color-danger)]">
                        sync: {p.syncError}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => moderateProject(p.id, "approved"))}
                      className="btn-primary"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        const reason = prompt("Reason for rejection (optional)") ?? undefined;
                        run(() => moderateProject(p.id, "rejected", reason));
                      }}
                      className="btn-danger"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Nominations awaiting review */}
      <section>
        <h2 className="eyebrow mb-3">Nominations in review · {data.pendingNominations.length}</h2>
        {data.pendingNominations.length === 0 ? (
          <p className="card p-5 text-sm text-[var(--color-muted)]">Nothing waiting.</p>
        ) : (
          <div className="space-y-3">
            {data.pendingNominations.map((n) => (
              <div key={n.id} className="card flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <TargetIcon name={n.targetName} size={18} />
                    <h3 className="font-semibold">{n.targetName}</h3>
                    {n.monthlyPriceUsd != null && (
                      <span className="mono chip text-[var(--color-acid)]">
                        {formatMoney(n.monthlyPriceUsd)}/mo
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{n.pitch}</p>
                  <div className="mono mt-2 flex gap-3 text-xs text-[var(--color-faint)]">
                    {n.authorLogin && <span>@{n.authorLogin}</span>}
                    <span>{formatDate(n.createdAt)}</span>
                    {n.targetUrl && (
                      <a href={n.targetUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-fg)]">
                        website
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => moderateNomination(n.id, "approved"))}
                    className="btn-primary"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => moderateNomination(n.id, "rejected"))}
                    className="btn-danger"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Log */}
      <section>
        <h2 className="eyebrow mb-3">Cycle log</h2>
        {data.log.length === 0 ? (
          <p className="card p-5 text-sm text-[var(--color-muted)]">The cycle has never run.</p>
        ) : (
          <div className="card divide-y divide-[var(--color-border)]">
            {data.log.map((entry) => (
              <div key={entry.id} className="p-4">
                <div className="mono flex items-center gap-2 text-xs text-[var(--color-faint)]">
                  <span>{formatDate(entry.ranAt)}</span>
                  <span className="chip py-0.5">{entry.trigger}</span>
                </div>
                <p className="mt-1.5 text-sm text-[var(--color-muted)]">{entry.summary}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StateCard({
  label,
  title,
  slug,
  sub,
  color,
}: {
  label: string;
  title?: string;
  slug?: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="card p-4" style={{ borderColor: title ? `color-mix(in oklab, ${color} 35%, transparent)` : undefined }}>
      <p className="eyebrow" style={{ color: title ? color : undefined }}>{label}</p>
      {title && slug ? (
        <>
          <Link href={`/challenges/${slug}`} className="mt-1.5 block text-sm font-medium hover:underline">
            {title}
          </Link>
          {sub && <p className="mono mt-1 text-xs text-[var(--color-muted)]">{sub}</p>}
        </>
      ) : (
        <p className="mt-1.5 text-sm text-[var(--color-faint)]">empty</p>
      )}
    </div>
  );
}

function NewContestForm({
  targets,
  prefill,
  onClear,
}: {
  targets: { id: number; name: string }[];
  prefill: ContestPrefill | null;
  onClear: () => void;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(createContest, null);
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLElement>(null);

  // A nomination picked further down the page has to land somewhere visible,
  // or the click looks like it did nothing
  useEffect(() => {
    if (!prefill) return;
    setOpen(true);
    anchor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [prefill]);

  // Once the contest exists the nomination is spent — drop the prefill so the
  // next open starts blank instead of inviting a duplicate
  useEffect(() => {
    if (state?.ok && prefill) onClear();
  }, [state, prefill, onClear]);

  return (
    // The header is sticky, so scrolling here without the offset tucks the
    // first line of the form underneath it
    <section ref={anchor} className="scroll-mt-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="eyebrow mb-3 hover:text-[var(--color-fg)]"
      >
        {open ? "− " : "+ "}Announce a contest
      </button>

      {open && (
        // Remounting on a new nomination is what lets uncontrolled inputs pick
        // up fresh defaults without fighting whatever was typed before
        <form
          key={prefill ? `t${prefill.targetId ?? 0}n${prefill.nominationId ?? 0}` : "blank"}
          action={action}
          className="card space-y-4 p-6"
        >
          <ActionMessage state={state} />

          {prefill && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-building)]/40 px-3 py-2 text-sm">
              <TargetIcon name={prefill.targetName} size={16} />
              <span>
                {prefill.nominationId ? (
                  <>
                    From the nomination for <strong>{prefill.targetName}</strong> — creating this
                    marks it promoted on Most wanted.
                  </>
                ) : (
                  <>
                    For <strong>{prefill.targetName}</strong> — the checklist you write here is what
                    its service page is missing.
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={onClear}
                className="mono ml-auto text-xs text-[var(--color-faint)] hover:text-[var(--color-fg)]"
              >
                start blank
              </button>
              {prefill.nominationId ? (
                <input type="hidden" name="originNominationId" value={prefill.nominationId} />
              ) : null}
            </div>
          )}

          <div>
            <label className="label" htmlFor="title">Contest title</label>
            <input
              id="title"
              name="title"
              required
              defaultValue={prefill?.title}
              placeholder="Miro alternative"
              className="input"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_140px]">
            <div>
              <label className="label" htmlFor="targetId">Service from the catalog</label>
              <select id="targetId" name="targetId" defaultValue={prefill?.targetId ?? ""} className="input">
                <option value="">— none —</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="newTargetName">…or a new service</label>
              <input
                id="newTargetName"
                name="newTargetName"
                defaultValue={prefill && !prefill.targetId ? prefill.targetName : undefined}
                placeholder="Miro"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="monthlyPriceUsd">$ per month</label>
              <input
                id="monthlyPriceUsd"
                name="monthlyPriceUsd"
                type="number"
                min="0"
                step="0.01"
                defaultValue={prefill?.monthlyPriceUsd ?? undefined}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="newTargetUrl">New service website</label>
            <input
              id="newTargetUrl"
              name="newTargetUrl"
              defaultValue={prefill?.targetUrl ?? undefined}
              placeholder="https://miro.com"
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="brief">Brief</label>
            <textarea
              id="brief"
              name="brief"
              required
              rows={3}
              defaultValue={prefill?.brief}
              placeholder="This week we build a Miro alternative: infinite canvas, sticky notes, real-time collaboration."
              className="input resize-y"
            />
          </div>

          <div>
            <label className="label" htmlFor="requirements">Required features</label>
            <textarea
              id="requirements"
              name="requirements"
              rows={5}
              autoFocus={!!prefill}
              placeholder={"Infinite canvas with zoom\nSticky notes and text blocks\nReal-time collaborative editing\nExport the board to PNG"}
              className="input resize-y font-mono text-sm"
            />
            <p className="mt-1.5 text-xs text-[var(--color-faint)]">
              One item per line. Becomes the checklist voters judge against and testers verify —
              leave it empty and the Test step has nothing to check.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="startNow"
              defaultChecked={!!prefill}
              className="accent-[var(--color-acid)]"
            />
            Start immediately (unless another contest is already accepting entries)
          </label>

          <SubmitButton>Create contest</SubmitButton>
        </form>
      )}
    </section>
  );
}
