import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import {
  findCoveredTarget,
  getNominationCategories,
  getNominations,
  getUserNominationVotes,
} from "@/lib/queries";
import { NominationRow } from "@/components/nomination-row";
import { NominationForm } from "@/components/nomination-form";
import { WantedFilters } from "@/components/wanted-filters";
import { TargetIcon } from "@/components/target-icon";
import { EmptyState } from "@/components/empty-state";
import { SignInButton } from "@/components/auth-buttons";
import { formatYearly, plural } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Most wanted replacements",
  description:
    "Vote for the software subscriptions you want replaced. The strongest demand becomes the next Subless Challenge.",
};
export const dynamic = "force-dynamic";

export default async function WantedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q = "", category = "" } = await searchParams;
  const query = q.trim();
  const activeCategory = category.trim();

  const session = await auth();
  const userId = session?.user?.id;

  const filtering = Boolean(query || activeCategory);

  const [nominations, allNominations, categories, myVotes, covered] = await Promise.all([
    getNominations("approved", query, activeCategory),
    filtering ? getNominations("approved") : Promise.resolve(null),
    getNominationCategories(),
    userId ? getUserNominationVotes(userId) : Promise.resolve(new Set<number>()),
    // Searching here may mean someone is about to nominate something the
    // community already replaced — worth saying so before they do
    query ? findCoveredTarget(query) : Promise.resolve(null),
  ]);

  const categoryName =
    categories.find((c) => c.slug === activeCategory)?.name ?? activeCategory;

  const total = allNominations?.length ?? nominations.length;
  const totalDemand = (allNominations ?? nominations).reduce((sum, n) => sum + n.votes, 0);

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-3">{BRAND.mechanism}</p>
        <h1 className="text-4xl font-bold tracking-tight">Most wanted replacements</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--color-muted)]">
          What SaaS subscription do you hate paying for? Vote it up. The strongest demand
          becomes the next Subless Challenge — so the community decides what should exist
          before anyone writes a line of it.
        </p>
        <p className="mono mt-4 text-sm text-[var(--color-faint)]">
          {total} {plural(total, "subscription", "subscriptions")} nominated · {totalDemand}{" "}
          {plural(totalDemand, "vote", "votes")} cast
        </p>
      </header>

      <WantedFilters
        categories={categories}
        total={total}
        current={{ q: query, category: activeCategory }}
      />

      {/* Already solved beats "not found": the answer they wanted is a working
          alternative, not the chance to ask for one */}
      {covered && (
        <Link
          href={`/alternatives/${covered.slug}`}
          className="card card-hover flex flex-wrap items-center justify-between gap-4 p-5"
          style={{ borderColor: "color-mix(in oklab, var(--color-acid) 35%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            <TargetIcon name={covered.name} logoUrl={covered.logoUrl} size={28} />
            <div>
              <p className="font-semibold">
                {covered.name} already has {covered.alternatives}{" "}
                {plural(covered.alternatives, "alternative", "alternatives")}
              </p>
              <p className="mono text-xs text-[var(--color-acid)]">
                {formatYearly(covered.monthlyPriceUsd)} you could stop paying
              </p>
            </div>
          </div>
          <span className="btn-primary pointer-events-none">
            Go Subless on {covered.name} <ArrowRight size={15} />
          </span>
        </Link>
      )}

      <section className="space-y-3">
        {nominations.length === 0 ? (
          query ? (
            <EmptyState
              title={`Nobody has nominated ${query} yet`}
              hint="Be the first — the form below already has it filled in. Say what you would actually need instead, and it becomes the challenge requirements."
            />
          ) : (
            activeCategory ? (
              <EmptyState
                title={`Nothing nominated under ${categoryName} yet`}
                hint="Pick another category, or nominate the first subscription in this one."
              />
            ) : (
              <EmptyState
                title="Nothing nominated yet"
                hint="Name a subscription you are tired of paying for. Once an admin checks it, everyone can vote."
              />
            )
          )
        ) : (
          <>
            {filtering && (
              <p className="mono text-xs text-[var(--color-faint)]">
                {nominations.length} {plural(nominations.length, "result", "results")}
                {query && <> for &quot;{query}&quot;</>}
                {activeCategory && <> in {categoryName}</>}
              </p>
            )}
            {nominations.map((n, i) => (
              <NominationRow
                key={n.id}
                nomination={n}
                voted={myVotes.has(n.id)}
                rank={filtering ? undefined : i + 1}
              />
            ))}
          </>
        )}
      </section>

      {userId ? (
        <NominationForm defaultName={nominations.length === 0 ? query : ""} />
      ) : (
        <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="text-sm text-[var(--color-muted)]">
            Sign in with GitHub to nominate a subscription and vote.
          </p>
          <SignInButton redirectTo={query ? `/wanted?q=${encodeURIComponent(query)}` : "/wanted"} />
        </div>
      )}
    </div>
  );
}
