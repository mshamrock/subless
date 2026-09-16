import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import {
  getCatalog,
  getCategoriesWithCounts,
  getTargetsWithCounts,
  getUserUpvotes,
} from "@/lib/queries";
import { ProjectCard } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";
import { CatalogFiltersBar } from "@/components/catalog-filters";
import { TargetIcon } from "@/components/target-icon";

export const metadata: Metadata = {
  title: "Community alternatives",
  description:
    "Free, community-built alternatives to paid subscriptions — everything the challenges have produced so far.",
};

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();

  const sort = (["score", "stars", "new", "alpha"] as const).includes(params.sort as never)
    ? (params.sort as "score" | "stars" | "new" | "alpha")
    : "score";

  const [projects, categories, targets, myUpvotes] = await Promise.all([
    getCatalog({ q: params.q, category: params.category, sort }),
    getCategoriesWithCounts(),
    getTargetsWithCounts(),
    session?.user?.id ? getUserUpvotes(session.user.id) : Promise.resolve(new Set<number>()),
  ]);

  const covered = targets.filter((t) => t.alternatives > 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight">Community alternatives</h1>
        <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
          Everything the challenges have produced. Search by the subscription you are paying
          for — the search matches both the alternative and the original it replaces.
        </p>
      </header>

      <CatalogFiltersBar
        categories={categories}
        current={{ q: params.q ?? "", category: params.category ?? "", sort }}
      />

      {covered.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3">You can go Subless on these</h2>
          <div className="flex flex-wrap gap-2">
            {covered.slice(0, 24).map((t) => (
              <Link key={t.id} href={`/alternatives/${t.slug}`} className="chip card-hover">
                <TargetIcon name={t.name} logoUrl={t.logoUrl} size={14} />
                {t.name}
                <span className="mono text-[var(--color-acid)]">{t.alternatives}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {projects.length === 0 ? (
        <EmptyState
          title="No matches"
          hint="Try a different query — or nominate the subscription so it becomes a challenge."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/wanted" className="btn-primary">Nominate a subscription</Link>
              <Link href="/submit" className="btn-ghost">I built one</Link>
            </div>
          }
        />
      ) : (
        <section className="space-y-3">
          <p className="mono text-xs text-[var(--color-faint)]">
            {projects.length} found
          </p>
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              upvoted={myUpvotes.has(p.id)}
              signedIn={Boolean(session?.user)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
