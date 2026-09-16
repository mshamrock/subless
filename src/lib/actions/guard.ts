import type { Session } from "next-auth";

/**
 * Minimum GitHub account age required to vote.
 * Freshly created accounts are the cheapest way to stuff a ballot, and a weekly
 * contest that hands the winner the homepage gives people a real incentive to try.
 */
export const MIN_ACCOUNT_AGE_DAYS = 30;

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string };

export function checkVotingEligibility(user: Session["user"] | undefined): ActionResult {
  if (!user?.id) return { ok: false, error: "Sign in with GitHub to vote" };

  // No creation date means the GitHub API was unreachable at sign-in. Don't block
  // on it, or an outage on their side switches off voting for the whole site
  if (!user.githubCreatedAt) return { ok: true };

  const ageDays = (Date.now() - new Date(user.githubCreatedAt).getTime()) / 86_400_000;
  if (ageDays < MIN_ACCOUNT_AGE_DAYS) {
    return {
      ok: false,
      error: `Voting requires a GitHub account older than ${MIN_ACCOUNT_AGE_DAYS} days. Yours is ${Math.floor(ageDays)}.`,
    };
  }
  return { ok: true };
}

export function toActionError(e: unknown): ActionResult {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "UNAUTHORIZED") return { ok: false, error: "You need to sign in with GitHub" };
  if (msg === "FORBIDDEN") return { ok: false, error: "Not enough permissions" };
  return { ok: false, error: msg };
}
