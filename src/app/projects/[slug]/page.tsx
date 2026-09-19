import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  Clock,
  Globe,
  Github,
  Star,
  GitFork,
  Users,
  Download,
  Trophy,
  BadgeCheck,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { BadgeSnippet } from "@/components/badge-snippet";
import {
  getAuthorSummary,
  getGithubDetails,
  getProjectBySlug,
  getProjectTestRating,
  getUserSwitchedTargets,
  hasUpvoted,
} from "@/lib/queries";
import { computeScore } from "@/lib/score";
import { computeBadges } from "@/lib/badges";
import { LivenessBadge } from "@/components/liveness-badge";
import { UpvoteButton } from "@/components/upvote-button";
import { TargetIcon } from "@/components/target-icon";
import { Avatar } from "@/components/avatar";
import { TryButton } from "@/components/try-button";
import { GoSublessButton } from "@/components/go-subless-button";
import { BadgeRow } from "@/components/badge-row";
import { RepoInsights } from "@/components/repo-insights";
import { CommentThread } from "@/components/comment-thread";
import {
  asSentence,
  formatDate,
  formatMoneyCompact,
  formatNumber,
  formatYearly,
  prettyHost,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) return { title: "Project not found" };

  // A build's own name is not what anyone searches for. What the build replaces
  // is — so the title carries it, and the name comes along for the brand query
  const replaces = project.targets.map((t) => t.name).join(" and ");

  return {
    title: replaces ? `${project.name} — a free ${replaces} alternative` : project.name,
    description: replaces
      ? `${asSentence(project.tagline)} Free and open source, built by the Subless community to replace ${replaces}.`
      : project.tagline,
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, session] = await Promise.all([getProjectBySlug(slug), auth()]);
  if (!project) notFound();

  const userId = session?.user?.id;
  const isAuthor = Boolean(userId) && project.submittedById === userId;
  const host = prettyHost(project.homepageUrl);

  const [upvoted, author, mySwitches, details, testRating] = await Promise.all([
    userId ? hasUpvoted(project.id, userId) : Promise.resolve(false),
    project.submittedById
      ? getAuthorSummary(project.submittedById)
      : Promise.resolve(null),
    userId ? getUserSwitchedTargets(userId) : Promise.resolve(new Set<number>()),
    getGithubDetails(project.id),
    getProjectTestRating(project.id),
  ]);

  // Offer the switch for the one subscription this build replaces; with several
  // targets the choice belongs on the product page, not guessed at here
  const switchTarget = project.targets.length === 1 ? project.targets[0] : null;

  // The same calculation the sync performs, shown in full so the ranking never
  // reads as a black box
  const breakdown = computeScore({
    stars: project.stars,
    forks: project.forks,
    contributors: project.contributors,
    releaseDownloads: project.downloads,
    upvotes: project.upvotes,
    clicks: project.clicks,
    starsDelta7d: project.starsDelta7d,
    pushedAt: project.pushedAt,
  });

  return (
    <div className="space-y-8">
      <nav className="mono text-xs text-[var(--color-faint)]">
        <Link href="/catalog" className="hover:text-[var(--color-fg)]">catalog</Link>
        <span className="mx-2">/</span>
        <span>{project.name}</span>
      </nav>

      <header className="flex flex-wrap items-start gap-5">
        <UpvoteButton
          projectId={project.id}
          count={project.upvotes}
          active={upvoted}
          signedIn={Boolean(userId)}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            {project.ownershipVerified && (
              <span className="chip border-[var(--color-acid-dim)]/40 text-[var(--color-acid)]">
                verified author
              </span>
            )}
            <LivenessBadge pushedAt={project.pushedAt} />
          </div>

          <p className="mt-2 max-w-2xl text-lg text-[var(--color-muted)]">{project.tagline}</p>

          {project.targets.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--color-faint)]">replaces</span>
              {project.targets.map((t) => (
                <Link key={t.id} href={`/alternatives/${t.slug}`} className="chip card-hover">
                  <TargetIcon name={t.name} logoUrl={t.logoUrl} size={14} />
                  {t.name}
                  {t.monthlyPriceUsd ? (
                    <span className="mono text-[var(--color-acid)]">{formatYearly(t.monthlyPriceUsd)}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          )}

          {/*
            * When a live site exists it is the primary action: someone weighing
            * this against a subscription wants to open it, not read its source.
            * With no live site, the repository takes the primary slot instead.
            */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {project.homepageUrl ? (
              <>
                <TryButton projectId={project.id} href={project.homepageUrl} label="Try it" />
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost"
                >
                  <Github size={16} /> Repository
                </a>
                <a
                  href={project.homepageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono flex items-center gap-1.5 text-sm text-[var(--color-faint)] hover:text-[var(--color-fg)]"
                >
                  <Globe size={13} /> {host}
                </a>
              </>
            ) : (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                <Github size={16} /> Repository
              </a>
            )}
          </div>

          {switchTarget && (
            <div className="mt-5 border-t border-[var(--color-border)] pt-5">
              <GoSublessButton
                targetId={switchTarget.id}
                targetName={switchTarget.name}
                monthlyPriceUsd={switchTarget.monthlyPriceUsd}
                projectId={project.id}
                active={mySwitches.has(switchTarget.id)}
                signedIn={Boolean(userId)}
              />
            </div>
          )}
        </div>
      </header>

      {project.status !== "approved" && (
        <div
          className="card flex flex-wrap items-center gap-3 p-4"
          style={{ borderColor: "color-mix(in oklab, var(--color-voting) 40%, transparent)" }}
        >
          <Clock size={18} className="text-[var(--color-voting)]" />
          <span className="text-sm text-[var(--color-muted)]">
            {project.status === "pending"
              ? "This build is waiting for review — it is not listed publicly yet. You can still enter it into a challenge."
              : "This build was not accepted."}
          </span>
        </div>
      )}

      {project.wins.length > 0 && (
        <div
          className="card flex flex-wrap items-center gap-3 p-4"
          style={{ borderColor: "color-mix(in oklab, var(--color-winner) 40%, transparent)" }}
        >
          <Trophy size={18} className="text-[var(--color-winner)]" />
          <span className="text-sm">
            Won the{" "}
            {project.wins.map((w, i) => (
              <span key={w.contestSlug}>
                {i > 0 && ", "}
                <Link href={`/challenges/${w.contestSlug}`} className="font-medium hover:underline">
                  {w.contestTitle}
                </Link>
              </span>
            ))}
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Only the author sees it: it goes in their repository, and for
              anyone else it is a control they cannot act on */}
          {isAuthor && (
            <section className="card p-6">
              <h2 className="eyebrow mb-1">Badge for your README</h2>
              <p className="mb-4 text-xs text-[var(--color-faint)]">
                It says what this build replaces, and switches to asking for votes on its own
                while a challenge it entered is running.
              </p>
              <BadgeSnippet
                imageUrl={`${BRAND.url}/api/badge/project/${project.slug}`}
                linkUrl={`${BRAND.url}/projects/${project.slug}`}
                alt={`${project.name} on Subless`}
                note="People who find your repository first see what it stands in for — and the link is a backlink that helps the whole catalog get found."
              />
            </section>
          )}

          {project.description && (
            <section className="card p-6">
              <h2 className="eyebrow mb-3">About</h2>
              <p className="whitespace-pre-line leading-relaxed text-[var(--color-fg)]">
                {project.description}
              </p>
            </section>
          )}

          {testRating && (
            <section className="card p-6">
              <h2 className="eyebrow mb-1">Community rating</h2>
              <p className="mb-5 text-xs text-[var(--color-faint)]">
                How much of what the challenge asked for testers found working.
              </p>

              <p className="mono text-3xl font-bold text-[var(--color-acid)]">
                {Math.round(testRating.rating * 100)}%
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                of required features verified by {testRating.testers}{" "}
                {testRating.testers === 1 ? "tester" : "testers"}
              </p>

              <ul className="mt-5 space-y-2">
                {testRating.perChallenge.map((c) => (
                  <li key={c.slug} className="flex items-center gap-3 text-sm">
                    <Link
                      href={`/challenges/${c.slug}`}
                      className="min-w-0 flex-1 truncate text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                    >
                      {c.title}
                    </Link>
                    <span className="mono shrink-0 text-xs text-[var(--color-faint)]">
                      {c.verified}/{c.total} verified · {c.testers}{" "}
                      {c.testers === 1 ? "tester" : "testers"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {details && (
            <RepoInsights details={details} repoFullName={project.repoFullName} />
          )}

          <section className="card p-6">
            <h2 className="eyebrow mb-4">How this score is built</h2>
            <div className="space-y-2">
              {breakdown.parts.map((part) => (
                <div key={part.label} className="flex items-center gap-3">
                  <span className="w-48 shrink-0 text-sm text-[var(--color-muted)]">
                    {part.label}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-acid-dim)]"
                      style={{
                        width: `${Math.min(100, (part.value / Math.max(1, breakdown.popularity)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="mono w-12 shrink-0 text-right text-xs text-[var(--color-faint)]">
                    {part.value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mono mt-5 space-y-1.5 border-t border-[var(--color-border)] pt-4 text-sm">
              <Row label="Popularity subtotal" value={breakdown.popularity.toFixed(2)} />
              <Row label="Weekly momentum" value={`+${breakdown.momentum.toFixed(2)}`} />
              <Row
                label="Liveness multiplier"
                value={`×${breakdown.liveness.toFixed(2)}`}
                hint={
                  breakdown.daysSincePush === null
                    ? "no commit data"
                    : `last commit ${breakdown.daysSincePush} days ago`
                }
              />
              <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-base font-bold">
                <span>Final score</span>
                <span className="text-[var(--color-acid)]">{breakdown.score.toFixed(1)}</span>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-[var(--color-faint)]">
              Liveness multiplies rather than adds: an abandoned project cannot be a working
              alternative, however many stars it collected. Release downloads only exist for
              projects that ship binaries, so web apps show an honest zero there.
            </p>
          </section>

          <CommentThread
            subjectType="project"
            subjectId={project.id}
            prompt="Does it actually replace the paid one? What is still missing?"
          />
        </div>

        <aside className="space-y-4">
          {project.authorLogin && (
            <section
              className="card p-5"
              style={{ borderColor: "color-mix(in oklab, var(--color-acid) 28%, transparent)" }}
            >
              <h2 className="eyebrow mb-4">Built by</h2>

              <Link
                href={`/builders/${project.authorLogin}`}
                className="group flex items-center gap-3"
              >
                <Avatar
                  src={project.authorImage}
                  name={project.authorName ?? project.authorLogin}
                  size={48}
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold group-hover:text-[var(--color-acid)]">
                    {project.authorName ?? project.authorLogin}
                  </p>
                  <p className="mono truncate text-xs text-[var(--color-muted)]">
                    @{project.authorLogin}
                  </p>
                </div>
              </Link>

              {project.ownershipVerified && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-acid)]">
                  <BadgeCheck size={14} />
                  Repository ownership verified
                </p>
              )}

              {author && (
                <>
                  {(() => {
                    const badges = computeBadges({
                      projectCount: author.projectCount,
                      winCount: author.winCount,
                      adoptions: author.adoptions,
                      replacedAnnualUsd: author.adoptedAnnualUsd,
                    });
                    return badges.length > 0 ? (
                      <div className="mt-4">
                        <BadgeRow badges={badges} />
                      </div>
                    ) : null;
                  })()}

                  {author.adoptedAnnualUsd > 0 ? (
                    <div className="mt-4 rounded-lg border border-[var(--color-acid-dim)]/30 bg-[var(--color-acid)]/5 px-4 py-3">
                      <p className="mono text-xl font-bold text-[var(--color-acid)]">
                        {formatMoneyCompact(author.adoptedAnnualUsd)}/year
                      </p>
                      <p className="text-[11px] text-[var(--color-muted)]">
                        cancelled by {author.adoptions}{" "}
                        {author.adoptions === 1 ? "person" : "people"} using their builds
                      </p>
                    </div>
                  ) : author.replacedAnnualUsd > 0 && (
                    <div className="mt-4 rounded-lg border border-[var(--color-border)] px-4 py-3">
                      <p className="mono text-xl font-bold text-[var(--color-fg)]">
                        {formatMoneyCompact(author.replacedAnnualUsd)}/year
                      </p>
                      <p className="text-[11px] text-[var(--color-muted)]">
                        their builds could replace — nobody has switched yet
                      </p>
                    </div>
                  )}

                  <dl className="mono mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-border)] text-center">
                    <AuthorStat label="builds" value={author.projectCount} />
                    <AuthorStat label="challenges" value={author.challengeCount} />
                    <AuthorStat label="wins" value={author.winCount} highlight={author.winCount > 0} />
                  </dl>
                </>
              )}
            </section>
          )}

          <section className="card p-5">
            <h2 className="eyebrow mb-4">GitHub metrics</h2>
            <dl className="space-y-3">
              <Metric icon={Star} label="Stars" value={formatNumber(project.stars)} delta={project.starsDelta7d} />
              <Metric icon={GitFork} label="Forks" value={formatNumber(project.forks)} />
              <Metric icon={Users} label="Contributors" value={formatNumber(project.contributors)} />
              <Metric icon={Download} label="Release downloads" value={formatNumber(project.downloads)} />
            </dl>

            <p className="mono mt-4 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-faint)]">
              {project.syncError
                ? `sync error: ${project.syncError}`
                : `updated ${formatDate(project.syncedAt)}`}
            </p>
          </section>

          <section className="card p-5">
            <h2 className="eyebrow mb-3">Details</h2>
            <dl className="space-y-2 text-sm">
              <InfoRow label="License" value={project.licenseSpdx ?? "not specified"} />
              <InfoRow label="Built with" value={project.builtWith ?? "not specified"} />
              <InfoRow label="Self-hosted" value={project.isSelfHosted ? "yes" : "no"} />
              <InfoRow
                label="Live site"
                value={
                  project.homepageUrl ? (
                    <a
                      href={project.homepageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--color-acid)]"
                    >
                      {host}
                    </a>
                  ) : (
                    "none"
                  )
                }
              />
              <InfoRow label="Added" value={formatDate(project.createdAt)} />
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function AuthorStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="bg-[var(--color-surface)] px-2 py-2.5">
      <dd
        className={`text-lg font-bold ${highlight ? "text-[var(--color-winner)]" : "text-[var(--color-fg)]"}`}
      >
        {value}
      </dd>
      <dt className="text-[10px] text-[var(--color-faint)]">{label}</dt>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between text-[var(--color-muted)]">
      <span>
        {label}
        {hint && <span className="ml-2 text-xs text-[var(--color-faint)]">({hint})</span>}
      </span>
      <span className="text-[var(--color-fg)]">{value}</span>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  delta?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        <Icon size={14} className="text-[var(--color-faint)]" />
        {label}
      </dt>
      <dd className="mono text-sm font-semibold">
        {value}
        {delta ? <span className="ml-1.5 text-xs text-[var(--color-acid)]">+{delta}</span> : null}
      </dd>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--color-faint)]">{label}</dt>
      <dd className="truncate text-right text-[var(--color-fg)]">{value}</dd>
    </div>
  );
}
