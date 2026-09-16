import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { getTargetDemandMap, getTargetsWithCounts } from "@/lib/queries";
import { TargetIcon } from "@/components/target-icon";
import { EmptyState } from "@/components/empty-state";
import { formatYearly, plural } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Alternatives by subscription",
  description:
    "Every subscription the community has put on the board, and the free alternatives built to replace it.",
};

export const dynamic = "force-dynamic";

/**
 * The hub every /alternatives/<service> page was missing.
 *
 * Those pages are the site's organic entry point — people search "calendly
 * alternative" — but until now the only internal links to them were the handful
 * of chips on /catalog, so most of them hung off the sitemap and nothing else.
 * A page nothing links to is a page search engines treat as unimportant, and a
 * page people cannot browse to is one they can only arrive at by luck.
 *
 * It is not /catalog under another name: /catalog lists the builds, this lists
 * the subscriptions. And it does not turn Subless into a directory, because a
 * service with nothing built for it is still shown — as demand, which is the
 * thing a directory has no way to express.
 */
export default async function AlternativesIndexPage() {
  const [targets, demand] = await Promise.all([getTargetsWithCounts(), getTargetDemandMap()]);

  const replaced = targets.filter((t) => t.alternatives > 0);

  const groups = new Map<
    string,
    { name: string; emoji: string | null; rows: typeof targets }
  >();
  for (const t of targets) {
    const key = t.categorySlug ?? "other";
    let group = groups.get(key);
    if (!group) {
      group = { name: t.categoryName ?? "Everything else", emoji: t.categoryEmoji, rows: [] };
      groups.set(key, group);
    }
    group.rows.push(t);
  }

  // Named categories first, alphabetically; the catch-all always last, because
  // "Everything else" leading the page reads as a site that has not been tidied
  const ordered = [...groups.entries()]
    .sort(([aKey, a], [bKey, b]) => {
      if (aKey === "other") return 1;
      if (bKey === "other") return -1;
      return a.name.localeCompare(b.name);
    })
    .map(([key, group]) => ({
      key,
      ...group,
      rows: [...group.rows].sort(
        (a, b) =>
          b.alternatives - a.alternatives ||
          (demand.get(b.id) ?? 0) - (demand.get(a.id) ?? 0) ||
          a.name.localeCompare(b.name),
      ),
    }));

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow mb-3">{BRAND.mechanism}</p>
        <h1 className="text-4xl font-bold tracking-tight">Alternatives by subscription</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--color-muted)]">
          Every paid service the community has put on the board. Some already have a free
          alternative built for them; the rest are waiting for a builder — which is what the
          vote on each page is for.
        </p>
        <p className="mono mt-4 text-sm text-[var(--color-faint)]">
          {targets.length} {plural(targets.length, "subscription", "subscriptions")} ·{" "}
          <span className="text-[var(--color-acid)]">
            {replaced.length} with a community build
          </span>
        </p>
      </header>

      {targets.length === 0 ? (
        <EmptyState
          title="Nothing on the board yet"
          hint="Nominate the subscription you resent paying for and it becomes the first one."
          action={
            <Link href="/wanted" className="btn-primary">
              Nominate a subscription
            </Link>
          }
        />
      ) : (
        <>
          {replaced.length > 0 && (
            <section>
              <h2 className="eyebrow mb-3">You can go Subless on these today</h2>
              <div className="flex flex-wrap gap-2">
                {replaced.map((t) => (
                  <Link key={t.id} href={`/alternatives/${t.slug}`} className="chip card-hover">
                    <TargetIcon name={t.name} logoUrl={t.logoUrl} size={14} />
                    {t.name}
                    <span className="mono text-[var(--color-acid)]">{t.alternatives}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {ordered.map((group) => (
            <section key={group.key}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                {group.emoji && <span aria-hidden="true">{group.emoji}</span>}
                {group.name}
                <span className="mono text-xs font-normal text-[var(--color-faint)]">
                  {group.rows.length}
                </span>
              </h2>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.rows.map((t) => {
                  const wanted = demand.get(t.id) ?? 0;
                  return (
                    <Link
                      key={t.id}
                      href={`/alternatives/${t.slug}`}
                      className="card card-hover flex items-start gap-3 p-4"
                    >
                      <TargetIcon name={t.name} logoUrl={t.logoUrl} size={28} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{t.name}</p>
                        {/* A zero price means free-but-costly-in-other-ways,
                            and "$0/year" under a name reads as nothing to save */}
                        {t.monthlyPriceUsd != null && t.monthlyPriceUsd > 0 && (
                          <p className="mono text-xs text-[var(--color-acid)]">
                            {formatYearly(t.monthlyPriceUsd)}
                          </p>
                        )}
                        <p className="mono mt-1 text-xs text-[var(--color-faint)]">
                          {t.alternatives > 0 ? (
                            <span className="text-[var(--color-fg)]">
                              {t.alternatives} {plural(t.alternatives, "build", "builds")}
                            </span>
                          ) : wanted > 0 ? (
                            <>
                              {wanted} {plural(wanted, "person wants", "people want")} it
                              replaced
                            </>
                          ) : (
                            "be the first to vote"
                          )}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-semibold">Paying for something that is not here?</p>
              <p className="text-sm text-[var(--color-muted)]">
                Nominate it. The strongest demand becomes the next challenge.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/wanted" className="btn-primary">
                Nominate a subscription
              </Link>
              <Link href="/submit" className="btn-ghost">
                Publish a build
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
