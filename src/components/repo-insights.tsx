import Link from "next/link";
import {
  AlertTriangle,
  Box,
  Container,
  FileCode,
  Layers,
  MessageSquare,
  Rocket,
  Tag,
} from "lucide-react";
import { Avatar } from "./avatar";
import { formatDate, formatNumber, plural } from "@/lib/utils";
import type { getGithubDetails } from "@/lib/queries";

type Details = NonNullable<Awaited<ReturnType<typeof getGithubDetails>>>;

export function RepoInsights({
  details,
  repoFullName,
}: {
  details: Details;
  repoFullName: string | null;
}) {
  const self = details.selfHost;
  const weeks = details.commitWeeks ?? [];
  const contributors = details.contributors ?? [];
  const issues = details.goodFirstIssues ?? [];

  return (
    <section className="card p-6">
      <h2 className="eyebrow mb-5">From the repository</h2>
      <div className="space-y-7">
        {self && <SelfHosting signals={self} />}
        {weeks.length > 0 && <Activity weeks={weeks} />}
        {details.release && <Release release={details.release} />}
        {contributors.length > 0 && (
          <BusFactor
            contributors={contributors}
            share={details.topContributorShare}
          />
        )}
        {issues.length > 0 && <GoodFirstIssues issues={issues} repo={repoFullName} />}
      </div>
    </section>
  );
}

/**
 * The decisive question for this site: can someone actually run this instead of
 * paying? A repository with a compose file and a repository that needs three
 * services wired by hand are different products to someone cancelling a
 * subscription, and no other catalog shows the difference.
 */
function SelfHosting({ signals }: { signals: NonNullable<Details["selfHost"]> }) {
  const ways = [
    { on: signals.compose, icon: Layers, label: "docker compose", note: "One command to run" },
    { on: signals.dockerfile, icon: Container, label: "Dockerfile", note: "Builds a container" },
    { on: signals.helm, icon: Box, label: "Helm chart", note: "Deploys to Kubernetes" },
    { on: signals.envExample, icon: FileCode, label: ".env example", note: "Configuration documented" },
  ].filter((w) => w.on);

  const ready = ways.length > 0 || signals.deployButtons.length > 0;

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        Self-hosting
        {ready ? (
          <span className="chip border-[var(--color-acid-dim)]/45 text-[var(--color-acid)]">
            ready to run
          </span>
        ) : (
          <span className="chip">build from source</span>
        )}
      </h3>

      {ready ? (
        <div className="flex flex-wrap gap-2">
          {ways.map((w) => (
            <span key={w.label} className="chip" title={w.note}>
              <w.icon size={13} />
              {w.label}
            </span>
          ))}
          {signals.deployButtons.map((b) => (
            <span
              key={b}
              className="chip border-[var(--color-building)]/40 text-[var(--color-building)]"
              title="One-click deploy offered in the README"
            >
              <Rocket size={13} />
              Deploy to {b}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-muted)]">
          No container or deploy recipe in the repository root — expect to build and wire it up
          yourself.
        </p>
      )}
    </div>
  );
}

/**
 * A year of commits, so the liveness multiplier in the score is something you
 * can see rather than something the page asserts. One commit yesterday on a dead
 * project and a steady year look identical as a date; they do not look identical
 * as a shape.
 */
function Activity({ weeks }: { weeks: number[] }) {
  const max = Math.max(...weeks, 1);
  const total = weeks.reduce((sum, w) => sum + w, 0);
  const activeWeeks = weeks.filter((w) => w > 0).length;
  const recent = weeks.slice(-12).reduce((sum, w) => sum + w, 0);

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">Activity</h3>

      <div
        className="flex h-12 items-end gap-[2px]"
        role="img"
        aria-label={`${total} commits over the last year, active in ${activeWeeks} of ${weeks.length} weeks`}
      >
        {weeks.map((count, i) => (
          <span
            key={i}
            title={`${count} ${plural(count, "commit", "commits")}`}
            className="flex-1 rounded-sm bg-[var(--color-acid-dim)]"
            style={{
              // A week with commits never renders as nothing — a 1px floor keeps
              // "quiet" visually distinct from "silent"
              height: `${count === 0 ? 2 : Math.max(8, (count / max) * 100)}%`,
              opacity: count === 0 ? 0.25 : 0.45 + (count / max) * 0.55,
            }}
          />
        ))}
      </div>

      <p className="mono mt-2 text-xs text-[var(--color-faint)]">
        {formatNumber(total)} commits in a year · active {activeWeeks} of {weeks.length} weeks ·{" "}
        {recent} in the last 12
      </p>
    </div>
  );
}

function Release({ release }: { release: NonNullable<Details["release"]> }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">Latest release</h3>
      <a
        href={release.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition-colors hover:border-[var(--color-border-strong)]"
      >
        <Tag size={16} className="text-[var(--color-acid)]" />
        <span className="mono font-semibold">{release.tag}</span>
        {release.name && release.name !== release.tag && (
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-muted)]">
            {release.name}
          </span>
        )}
        <span className="mono ml-auto text-xs text-[var(--color-faint)]">
          {formatDate(release.publishedAt ? new Date(release.publishedAt) : null)}
          {release.assets > 0 && (
            <>
              {" · "}
              {release.assets} {plural(release.assets, "download", "downloads")}
              {release.downloads > 0 && ` · ${formatNumber(release.downloads)} pulled`}
            </>
          )}
        </span>
      </a>
    </div>
  );
}

/**
 * Contributor concentration, not a credits roll. "801 contributors" hides the
 * case where one person wrote nearly all of it — which is the risk that matters
 * to someone about to depend on this instead of a paid product.
 */
function BusFactor({
  contributors,
  share,
}: {
  contributors: NonNullable<Details["contributors"]>;
  share: number | null;
}) {
  const concentrated = share !== null && share >= 0.8 && contributors.length > 0;

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        Who maintains it
        {concentrated && (
          <span
            className="chip border-[var(--color-voting)]/45 text-[var(--color-voting)]"
            title="One person wrote most of it — a real risk if they stop"
          >
            <AlertTriangle size={12} />
            one-person project
          </span>
        )}
      </h3>

      <div className="flex flex-wrap items-center gap-3">
        {contributors.map((c) => (
          <a
            key={c.login}
            href={`https://github.com/${c.login}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`${c.login} · ${formatNumber(c.commits)} commits`}
            className="flex items-center gap-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            <Avatar src={c.avatar} name={c.login} size={24} />
            <span className="mono">{c.login}</span>
          </a>
        ))}
      </div>

      {share !== null && (
        <p className="mono mt-3 text-xs text-[var(--color-faint)]">
          top contributor wrote {Math.round(share * 100)}% of the commits
        </p>
      )}
    </div>
  );
}

/** The one block here that is not about deciding — it is about joining in. */
function GoodFirstIssues({
  issues,
  repo,
}: {
  issues: NonNullable<Details["goodFirstIssues"]>;
  repo: string | null;
}) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">Good first issues</h3>
      <p className="mb-3 text-xs text-[var(--color-faint)]">
        Tasks the maintainers marked as a decent way in.
      </p>

      <ul className="space-y-1.5">
        {issues.map((issue) => (
          <li key={issue.number}>
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm transition-colors hover:border-[var(--color-border-strong)]"
            >
              <span className="mono shrink-0 text-xs text-[var(--color-faint)]">
                #{issue.number}
              </span>
              <span className="min-w-0 flex-1 truncate">{issue.title}</span>
              {issue.comments > 0 && (
                <span className="mono flex shrink-0 items-center gap-1 text-xs text-[var(--color-faint)]">
                  <MessageSquare size={11} />
                  {issue.comments}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>

      {repo && (
        <Link
          href={`https://github.com/${repo}/issues?q=is%3Aopen+label%3A%22good+first+issue%22`}
          className="mono mt-2 inline-block text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          all good first issues →
        </Link>
      )}
    </div>
  );
}
