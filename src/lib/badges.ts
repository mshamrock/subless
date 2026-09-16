/**
 * Builder recognition (brief §12).
 *
 * "If builders are not primarily motivated by cash, contribution must create
 * visible status. Profiles should show impact rather than vanity activity."
 *
 * So every badge here is earned by something that happened to other people —
 * a build adopted, a subscription cancelled, a challenge won. None of them can
 * be earned by activity alone, because a badge for showing up is worth nothing
 * to the person holding it and misleads everyone reading it.
 */

export interface Badge {
  id: string;
  label: string;
  description: string;
  tone: "acid" | "winner" | "building" | "muted";
}

export interface BadgeInput {
  projectCount: number;
  winCount: number;
  /** People who recorded going Subless using one of this builder's alternatives. */
  adoptions: number;
  /** Annual subscription cost cancelled through those builds, in USD. */
  replacedAnnualUsd: number;
}

/** Tier thresholds, highest first so only the top one in a family is awarded. */
const ADOPTION_TIERS = [10_000, 1_000, 100, 10] as const;
const REPLACED_TIERS = [100_000, 10_000, 1_000] as const;

function compact(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}K`;
  return String(n);
}

export function computeBadges(input: BadgeInput): Badge[] {
  const badges: Badge[] = [];

  if (input.projectCount > 0) {
    badges.push({
      id: "first-build",
      label: "First Build",
      description: "Published an alternative the community can use",
      tone: "acid",
    });
  }

  if (input.winCount > 0) {
    badges.push({
      id: "community-pick",
      label: input.winCount > 1 ? `Community Pick ×${input.winCount}` : "Community Pick",
      description:
        input.winCount > 1
          ? `Won ${input.winCount} weekly challenges`
          : "Won a weekly challenge",
      tone: "winner",
    });
  }

  // Only the highest tier reached — a shelf of every milestone ever passed is noise
  const adoptionTier = ADOPTION_TIERS.find((t) => input.adoptions >= t);
  if (adoptionTier) {
    badges.push({
      id: `adopters-${adoptionTier}`,
      label: `${compact(adoptionTier)} Adopters`,
      description: `${input.adoptions} people went Subless using their builds`,
      tone: "building",
    });
  }

  const replacedTier = REPLACED_TIERS.find((t) => input.replacedAnnualUsd >= t);
  if (replacedTier) {
    badges.push({
      id: `replaced-${replacedTier}`,
      label: `$${compact(replacedTier)} Replaced`,
      description: `$${input.replacedAnnualUsd.toLocaleString("en-US")}/year in subscriptions cancelled through their work`,
      tone: "acid",
    });
  }

  if (input.projectCount >= 3) {
    badges.push({
      id: "serial-builder",
      label: "Serial Builder",
      description: `${input.projectCount} published alternatives`,
      tone: "muted",
    });
  }

  return badges;
}
