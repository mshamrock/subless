import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Github, Trophy } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getAuthorSummary,
  getProfileBuilds,
  getProfileByLogin,
  getProfileWins,
  getUserUpvotes,
} from "@/lib/queries";
import { computeBadges } from "@/lib/badges";
import { Avatar } from "@/components/avatar";
import { BadgeRow } from "@/components/badge-row";
import { ProjectCard } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";
import { formatDate, formatMoneyCompact, plural } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ login: string }>;
}): Promise<Metadata> {
  const { login } = await params;
  const profile = await getProfileByLogin(login);
  if (!profile) return { title: "Builder not found" };
  return {
    title: profile.name ?? `@${profile.login}`,
    description: `Free alternatives built by ${profile.name ?? profile.login} on Subless.`,
  };
}

export default async function BuilderProfilePage({
  params,
}: {
  params: Promise<{ login: string }>;
}) {
  const { login } = await params;
  const [profile, session] = await Promise.all([getProfileByLogin(login), auth()]);
  if (!profile?.login) notFound();

  const [summary, builds, wins] = await Promise.all([
    getAuthorSummary(profile.id),
    getProfileBuilds(profile.id),
    getProfileWins(profile.id),
  ]);
  const myUpvotes = session?.user?.id
    ? await getUserUpvotes(session.user.id)
    : new Set<number>();

  const badges = computeBadges({
    projectCount: summary.projectCount,
    winCount: summary.winCount,
    adoptions: summary.adoptions,
    replacedAnnualUsd: summary.adoptedAnnualUsd,
  });

  const isSelf = session?.user?.id === profile.id;

  return (
    <div className="space-y-8">
      <nav className="mono text-xs text-[var(--color-faint)]">
        <Link href="/leaderboard" className="hover:text-[var(--color-fg)]">builders</Link>
        <span className="mx-2">/</span>
        <span>@{profile.login}</span>
      </nav>

      <header className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar src={profile.image} name={profile.name ?? profile.login} size={72} />

          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {profile.name ?? profile.login}
            </h1>
            <p className="mono mt-1 text-sm text-[var(--color-muted)]">@{profile.login}</p>

            {badges.length > 0 && (
              <div className="mt-4">
                <BadgeRow badges={badges} />
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={`https://github.com/${profile.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                <Github size={15} /> GitHub
              </a>
              {isSelf && (
                <>
                  <Link href="/savings" className="btn-ghost">
                    Your savings
                  </Link>
                  <Link href="/settings" className="btn-ghost">
                    Settings
                  </Link>
                </>
              )}
              <span className="mono text-xs text-[var(--color-faint)]">
                joined {formatDate(profile.joinedAt)}
              </span>
            </div>
          </div>

          {/* Impact first, in the same unit as the site's North Star, so one
              builder's contribution reads against the whole community's */}
          {summary.adoptedAnnualUsd > 0 && (
            <div
              className="rounded-lg border px-5 py-4"
              style={{ borderColor: "color-mix(in oklab, var(--color-acid) 35%, transparent)" }}
            >
              <p className="mono text-2xl font-bold text-[var(--color-acid)]">
                {formatMoneyCompact(summary.adoptedAnnualUsd)}/year
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                cancelled by {summary.adoptions}{" "}
                {plural(summary.adoptions, "person", "people")} using their builds
              </p>
            </div>
          )}
        </div>

        <dl className="mono mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-border)] text-center">
          <Stat label="builds" value={summary.projectCount} />
          <Stat label="challenges" value={summary.challengeCount} />
          <Stat label="wins" value={summary.winCount} highlight={summary.winCount > 0} />
        </dl>
      </header>

      {wins.length > 0 && (
        <section className="space-y-2">
          <h2 className="eyebrow">Challenge wins</h2>
          {wins.map((w) => (
            <Link
              key={w.contestSlug}
              href={`/challenges/${w.contestSlug}`}
              className="card card-hover flex flex-wrap items-center gap-3 p-4"
            >
              <Trophy size={17} className="text-[var(--color-winner)]" />
              <span className="text-sm">
                <span className="font-semibold">{w.projectName}</span>
                <span className="text-[var(--color-muted)]"> won </span>
                <span className="font-medium">{w.contestTitle}</span>
              </span>
              <span className="mono ml-auto text-xs text-[var(--color-faint)]">
                {formatDate(w.endsAt)}
              </span>
            </Link>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="eyebrow">
          {builds.length} {plural(builds.length, "build", "builds")}
        </h2>

        {builds.length === 0 ? (
          <EmptyState
            title="Nothing published yet"
            hint={
              isSelf
                ? "Publish an alternative and it shows up here."
                : "This builder has not published an alternative yet."
            }
            action={
              isSelf ? (
                <Link href="/submit" className="btn-primary">Publish a build</Link>
              ) : undefined
            }
          />
        ) : (
          builds.map((b) => (
            <ProjectCard
              key={b.id}
              project={b}
              upvoted={myUpvotes.has(b.id)}
              signedIn={Boolean(session?.user)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="bg-[var(--color-surface)] px-3 py-3.5">
      <dd
        className={`text-xl font-bold ${highlight ? "text-[var(--color-winner)]" : "text-[var(--color-fg)]"}`}
      >
        {value}
      </dd>
      <dt className="text-[11px] text-[var(--color-faint)]">{label}</dt>
    </div>
  );
}
