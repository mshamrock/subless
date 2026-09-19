import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Check, ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { goSublessOn } from "@/lib/brand";
import {
  getCatalog,
  getTargetBySlug,
  getTargetSubstance,
  getTargetDemand,
  getTargetSwitchCount,
  getUserSwitchedTargets,
  getUserUpvotes,
} from "@/lib/queries";
import { ProjectCard } from "@/components/project-card";
import { TargetIcon } from "@/components/target-icon";
import { GoSublessButton } from "@/components/go-subless-button";
import { EmptyState } from "@/components/empty-state";
import { formatYearly, plural } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const target = await getTargetBySlug(slug);
  if (!target) return { title: "Service not found" };

  const substance = await getTargetSubstance(target.id);

  // The templated line differs only by a name and a number, so leaving it in
  // place means a hundred near-duplicate snippets competing with each other.
  // Copy written in the admin's SEO panel always beats it
  const written = target.description?.trim();

  // "Go Subless on Notion" is a brand phrase nobody types. What people search
  // is "notion alternative", and the title has to say the page holds one —
  // with the count, because a number in a result is worth more than an adjective
  const title =
    substance.builds > 0
      ? `${substance.builds} free ${target.name} ${plural(substance.builds, "alternative", "alternatives")}`
      : substance.votes > 0
        ? `Free ${target.name} alternative wanted — ${substance.votes} ${plural(substance.votes, "vote", "votes")}`
        : `Free ${target.name} alternatives`;

  return {
    title,
    description: written
      ? metaSummary(written)
      : substance.builds > 0
        ? `Free community-built alternatives to ${target.name}. ${formatYearly(target.monthlyPriceUsd)} you could stop paying.`
        : `Nobody has built a free ${target.name} alternative yet. Vote it up and it becomes the next Subless Challenge.`,
    // Nothing built and nobody asking yet: the page is a template with a name in
    // it. `follow` stays on, so it still passes link equity to the catalog and
    // comes back into the index by itself the moment it has either
    robots: substance.indexable ? undefined : { index: false, follow: true },
  };
}

/** The first ~160 characters, cut at a word boundary rather than mid-word. */
function metaSummary(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 160) return flat;
  const cut = flat.slice(0, 160);
  return `${cut.slice(0, cut.lastIndexOf(" "))}\u2026`;
}

export default async function AlternativesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [target, session] = await Promise.all([getTargetBySlug(slug), auth()]);
  if (!target) notFound();

  const userId = session?.user?.id;
  const [projects, demand, switchCount, myUpvotes, mySwitches] = await Promise.all([
    getCatalog({ target: slug, sort: "score" }),
    getTargetDemand(target.id),
    getTargetSwitchCount(target.id),
    userId ? getUserUpvotes(userId) : Promise.resolve(new Set<number>()),
    userId ? getUserSwitchedTargets(userId) : Promise.resolve(new Set<number>()),
  ]);

  return (
    <div className="space-y-8">
      <nav className="mono text-xs text-[var(--color-faint)]">
        <Link href="/alternatives" className="hover:text-[var(--color-fg)]">alternatives</Link>
        <span className="mx-2">/</span>
        <span>{target.name}</span>
      </nav>

      {/* Product page layout follows brief §7: icon, annual price, demand,
          what people actually need, then the two actions */}
      <header className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <TargetIcon name={target.name} logoUrl={target.logoUrl} size={44} />
              {/* The phrase people search, not the brand alone: this page is the
                  alternatives to a service, and its heading should say so */}
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {target.name}{" "}
                <span className="font-semibold text-[var(--color-muted)]">alternatives</span>
              </h1>
            </div>

            {target.monthlyPriceUsd != null && (
              <p className="mono mt-3 text-2xl font-bold text-[var(--color-acid)]">
                {formatYearly(target.monthlyPriceUsd)}
              </p>
            )}

            <p className="mt-1.5 text-sm text-[var(--color-muted)]">
              {switchCount > 0 ? (
                <span className="text-[var(--color-acid)]">
                  {switchCount} {plural(switchCount, "person", "people")} already went Subless
                  on it
                </span>
              ) : demand > 0 ? (
                <>
                  {demand} {plural(demand, "person wants", "people want")} an alternative
                </>
              ) : null}
            </p>

            {target.description && (
              <p className="mt-4 max-w-2xl text-[var(--color-muted)]">{target.description}</p>
            )}

            {projects.length > 0 && (
              <div className="mt-6">
                <GoSublessButton
                  targetId={target.id}
                  targetName={target.name}
                  monthlyPriceUsd={target.monthlyPriceUsd}
                  active={mySwitches.has(target.id)}
                  signedIn={Boolean(userId)}
                />
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/wanted" className={projects.length > 0 ? "btn-ghost" : "btn-primary"}>
                I want this replaced
              </Link>
              {projects.length > 0 && (
                <a href="#builds" className="btn-ghost">
                  View community builds
                </a>
              )}
              {target.websiteUrl && (
                <a
                  href={target.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono flex items-center gap-1.5 text-sm text-[var(--color-faint)] hover:text-[var(--color-fg)]"
                >
                  official site <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>

          {target.requirements.length > 0 && (
            <div className="min-w-[240px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
              <p className="eyebrow mb-3">What people actually need</p>
              <ul className="space-y-2">
                {target.requirements.map((req, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[var(--color-fg)]">
                    <Check size={14} className="mt-0.5 shrink-0 text-[var(--color-acid)]" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </header>

      <section id="builds" className="scroll-mt-24 space-y-3">
        {projects.length === 0 ? (
          <EmptyState
            title={`Nobody has built a ${target.name} alternative yet`}
            hint="Vote it up so it becomes the next challenge — or build it yourself and be the first."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/wanted" className="btn-primary">I want this replaced</Link>
                <Link href="/submit" className="btn-ghost">I built one</Link>
              </div>
            }
          />
        ) : (
          <>
            <h2 className="eyebrow">
              {projects.length} community {plural(projects.length, "build", "builds")}
            </h2>
            {projects.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                rank={i + 1}
                upvoted={myUpvotes.has(p.id)}
                signedIn={Boolean(session?.user)}
              />
            ))}
          </>
        )}
      </section>
    </div>
  );
}
