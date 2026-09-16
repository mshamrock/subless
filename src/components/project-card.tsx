import Link from "next/link";
import { Github, Globe, Star, GitFork, Users } from "lucide-react";
import { LivenessBadge } from "./liveness-badge";
import { TargetIcon } from "./target-icon";
import { UpvoteButton } from "./upvote-button";
import { TryButton } from "./try-button";
import { formatNumber, formatYearly, prettyHost } from "@/lib/utils";
import type { TargetChip } from "@/lib/queries";

export interface ProjectCardData {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  repoUrl: string;
  homepageUrl: string | null;
  builtWith: string | null;
  ownershipVerified: boolean;
  stars: number;
  forks: number;
  contributors: number;
  upvotes: number;
  score: number;
  starsDelta7d: number;
  pushedAt: Date | null;
  targets: TargetChip[];
  authorLogin?: string | null;
}

export function ProjectCard({
  project,
  rank,
  upvoted = false,
  signedIn = false,
}: {
  project: ProjectCardData;
  rank?: number;
  upvoted?: boolean;
  signedIn?: boolean;
}) {
  const host = prettyHost(project.homepageUrl);

  return (
    /*
     * The whole card is the click target. It is done with a stretched pseudo-element
     * on the title link rather than by wrapping the card in an <a>: the card already
     * contains a button and several links, and anchors cannot legally nest.
     * Everything interactive is lifted above the overlay with z-10.
     */
    <article className="card card-hover group relative flex gap-4 p-4">
      {rank !== undefined && (
        <div className="mono w-8 shrink-0 pt-1 text-lg font-bold text-[var(--color-faint)]">
          {rank}
        </div>
      )}

      <div className="relative z-10 shrink-0 pt-0.5">
        <UpvoteButton
          projectId={project.id}
          count={project.upvotes}
          active={upvoted}
          signedIn={signedIn}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/projects/${project.slug}`}
            className="text-[15px] font-semibold after:absolute after:inset-0 after:content-[''] group-hover:text-[var(--color-acid)]"
          >
            {project.name}
          </Link>
          {project.ownershipVerified && (
            <span
              title="Author verified repository ownership through GitHub"
              className="rounded border border-[var(--color-acid-dim)]/40 px-1.5 py-px text-[10px] text-[var(--color-acid)]"
            >
              author
            </span>
          )}
          <LivenessBadge pushedAt={project.pushedAt} />
        </div>

        <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">{project.tagline}</p>

        {project.targets.length > 0 && (
          <div className="relative z-10 mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[var(--color-faint)]">replaces</span>
            {project.targets.map((t) => (
              <Link
                key={t.id}
                href={`/alternatives/${t.slug}`}
                className="chip hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
              >
                <TargetIcon name={t.name} logoUrl={t.logoUrl} size={14} />
                {t.name}
                {t.monthlyPriceUsd ? (
                  <span className="mono text-[var(--color-acid)]">{formatYearly(t.monthlyPriceUsd)}</span>
                ) : null}
              </Link>
            ))}
          </div>
        )}

        <div className="mono mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--color-faint)]">
          <span className="flex items-center gap-1" title="GitHub stars">
            <Star size={12} /> {formatNumber(project.stars)}
            {project.starsDelta7d > 0 && (
              <span className="text-[var(--color-acid)]">+{project.starsDelta7d}</span>
            )}
          </span>
          <span className="flex items-center gap-1" title="Forks">
            <GitFork size={12} /> {formatNumber(project.forks)}
          </span>
          <span className="flex items-center gap-1" title="Contributors">
            <Users size={12} /> {formatNumber(project.contributors)}
          </span>
          <span title="Composite score" className="text-[var(--color-acid-dim)]">
            score {project.score.toFixed(1)}
          </span>
          {host && (
            <span className="flex items-center gap-1" title={project.homepageUrl ?? undefined}>
              <Globe size={12} /> {host}
            </span>
          )}
          {project.builtWith && (
            <span className="text-[var(--color-muted)]">built with {project.builtWith}</span>
          )}
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 flex-col items-stretch gap-1.5">
        {project.homepageUrl && (
          <TryButton
            projectId={project.id}
            href={project.homepageUrl}
            label="Try"
            variant="compact"
            className="justify-center"
          />
        )}
        <a
          href={project.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Repository"
          className="flex justify-center rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
        >
          <Github size={15} />
        </a>
      </div>
    </article>
  );
}
