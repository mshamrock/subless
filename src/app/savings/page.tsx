import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getUserSwitches } from "@/lib/queries";
import { TargetIcon } from "@/components/target-icon";
import { EmptyState } from "@/components/empty-state";
import { ShareSavings } from "@/components/share-savings";
import { formatDate, formatMoneyCompact, formatYearly, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Your savings" };
export const dynamic = "force-dynamic";

export default async function SavingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/savings");

  const rows = await getUserSwitches(session.user.id);
  const annual = rows.reduce((sum, r) => sum + r.annualUsd, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="eyebrow mb-3">Go Subless</p>
        <h1 className="text-4xl font-bold tracking-tight">Your savings</h1>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="You have not gone Subless on anything yet"
          hint="When a community build genuinely replaces something you pay for, mark it here. It counts toward what the whole community has replaced."
          action={
            <Link href="/catalog" className="btn-primary">
              Browse community alternatives
            </Link>
          }
        />
      ) : (
        <>
          <section
            className="card p-6 sm:p-8"
            style={{ borderColor: "color-mix(in oklab, var(--color-acid) 40%, transparent)" }}
          >
            <p className="mono text-4xl font-bold text-[var(--color-acid)] sm:text-5xl">
              {formatMoneyCompact(annual)}/year
            </p>
            <p className="mt-2 text-[var(--color-muted)]">
              across {rows.length} {plural(rows.length, "subscription", "subscriptions")} you
              stopped renting
            </p>

            <div className="mt-6">
              <ShareSavings
                annual={annual}
                names={rows.map((r) => r.targetName)}
              />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="eyebrow">What you replaced</h2>
            {rows.map((r) => (
              <div key={r.id} className="card flex flex-wrap items-center gap-4 p-4">
                <TargetIcon name={r.targetName} logoUrl={r.targetLogo} size={28} />

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/alternatives/${r.targetSlug}`}
                    className="font-semibold hover:text-[var(--color-acid)]"
                  >
                    {r.targetName}
                  </Link>
                  <p className="mono text-xs text-[var(--color-faint)]">
                    {r.projectSlug ? (
                      <>
                        replaced with{" "}
                        <Link
                          href={`/projects/${r.projectSlug}`}
                          className="hover:text-[var(--color-fg)]"
                        >
                          {r.projectName}
                        </Link>{" "}
                        ·{" "}
                      </>
                    ) : null}
                    {formatDate(r.createdAt)}
                  </p>
                </div>

                <p className="mono shrink-0 font-semibold text-[var(--color-acid)]">
                  {formatYearly(r.annualUsd / 12)}
                </p>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
