import Link from "next/link";
import type { Metadata } from "next";
import { Hammer, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { getAllTargetsForPicker, getContestBySlug, getNominations } from "@/lib/queries";
import { getWeeklyState } from "@/lib/cycle";
import { SubmitProjectForm } from "@/components/submit-project-form";
import { SignInButton } from "@/components/auth-buttons";
import { TargetIcon } from "@/components/target-icon";
import { formatYearly, plural, timeLeft } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Publish a build",
  description: "Share the free alternative you built with the community.",
};
export const dynamic = "force-dynamic";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>;
}) {
  const { challenge: challengeSlug } = await searchParams;

  const [session, targets, weekly, nominations] = await Promise.all([
    auth(),
    getAllTargetsForPicker(),
    getWeeklyState(),
    getNominations("approved"),
  ]);

  // An explicit ?challenge= wins; otherwise offer whatever is open this week
  const challenge = challengeSlug ? await getContestBySlug(challengeSlug) : null;
  const openChallenge =
    challenge && challenge.status === "building" ? challenge : null;
  const thisWeek = weekly.building ?? null;
  const topWanted = nominations.find((n) => n.votes > 0) ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <p className="eyebrow mb-3">Build · step 3 of the Subless model</p>
        <h1 className="text-4xl font-bold tracking-tight">Publish your build</h1>
        <p className="mt-3 text-lg leading-relaxed text-[var(--color-muted)]">
          Tell the community what you replaced. Once an admin checks it, people can use it,
          rate it, and go Subless on the subscription it stands in for.
        </p>
      </header>

      {/* Builders should never start from a blank page — the brief's whole pitch to
          them is that demand is validated before anyone writes code */}
      {openChallenge ? (
        <div
          className="card p-5"
          style={{ borderColor: "color-mix(in oklab, var(--color-building) 40%, transparent)" }}
        >
          <p className="eyebrow mb-2 flex items-center gap-2 text-[var(--color-building)]">
            <Hammer size={13} /> Entering this challenge
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {openChallenge.targetName && (
              <TargetIcon name={openChallenge.targetName} logoUrl={openChallenge.targetLogo} size={20} />
            )}
            <h2 className="text-lg font-semibold">{openChallenge.title}</h2>
          </div>
          <p className="mono mt-1 text-xs text-[var(--color-muted)]">
            entries close in {timeLeft(openChallenge.votingStartsAt)}
          </p>

          {openChallenge.requirements.length > 0 && (
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {openChallenge.requirements.map((req, i) => (
                <li key={i} className="flex gap-2 text-sm text-[var(--color-muted)]">
                  <span className="mono shrink-0 text-[var(--color-building)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {req}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-xs text-[var(--color-faint)]">
            Publishing here enters your build into the challenge automatically.
          </p>
        </div>
      ) : (
        (thisWeek || topWanted) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {thisWeek && (
            <Link href={`/submit?challenge=${thisWeek.slug}`} className="card card-hover p-4">
              <p className="eyebrow mb-2 flex items-center gap-2 text-[var(--color-building)]">
                <Hammer size={13} /> This week&apos;s challenge
              </p>
              <p className="text-sm font-semibold">{thisWeek.title}</p>
              <p className="mono mt-1 text-xs text-[var(--color-muted)]">
                {timeLeft(thisWeek.votingStartsAt)} left to enter
              </p>
            </Link>
          )}

          {/* Only worth showing once someone has actually voted. A candidate with
              zero votes presented as "most wanted" reads as a bug, because it is
              one — the ordering just falls back to insertion order. */}
          {topWanted && (
            <Link href="/wanted" className="card card-hover p-4">
              <p className="eyebrow mb-2 flex items-center gap-2">
                <TrendingUp size={13} /> Most wanted
              </p>
              <p className="text-sm font-semibold">
                {topWanted.targetName}
                {topWanted.monthlyPriceUsd != null && (
                  <span className="mono ml-2 text-xs text-[var(--color-acid)]">
                    {formatYearly(topWanted.monthlyPriceUsd)}
                  </span>
                )}
              </p>
              <p className="mono mt-1 text-xs text-[var(--color-muted)]">
                {topWanted.votes} {plural(topWanted.votes, "person wants", "people want")} it
                replaced
              </p>
            </Link>
          )}
        </div>
        )
      )}

      {session?.user ? (
        <SubmitProjectForm
          targets={targets}
          challengeSlug={openChallenge?.slug}
          challengeTitle={openChallenge?.title}
        />
      ) : (
        <div className="card space-y-4 p-8 text-center">
          <p className="text-[var(--color-muted)]">
            GitHub sign-in serves two purposes: we verify the repository is actually yours,
            and the card shows that with a badge.
          </p>
          <SignInButton
            redirectTo={challengeSlug ? `/submit?challenge=${challengeSlug}` : "/submit"}
            className="mx-auto"
          />
        </div>
      )}
    </div>
  );
}
