/**
 * Composite score used to rank alternatives.
 *
 * Why not plain "downloads": GitHub only reports download counts for release
 * assets. Most vibe-coded alternatives are web apps with no releases at all,
 * so that metric is silent for half the catalog.
 *
 * Hence a composite of three groups:
 *   popularity — how many people found the project (stars, forks, downloads, upvotes)
 *   contribution — how many people actually touch it (contributors)
 *   liveness — a multiplier. An abandoned project is not an alternative, whatever else it is.
 *
 * Liveness multiplies rather than adds: 5000 stars on a dead fork should not
 * outrank a living project with 200. This is the defining disease of
 * vibe-coded app directories, so it gets the strongest lever in the formula.
 *
 * Logarithms throughout, so one breakout hit cannot flatten the whole table.
 */

export interface ScoreInput {
  stars: number;
  forks: number;
  contributors: number;
  releaseDownloads: number;
  upvotes: number;
  clicks: number;
  starsDelta7d: number;
  pushedAt: Date | null;
}

export interface ScoreBreakdown {
  score: number;
  popularity: number;
  momentum: number;
  liveness: number;
  daysSincePush: number | null;
  parts: { label: string; value: number }[];
}

const ln = (n: number) => Math.log(1 + Math.max(0, n));

/** Liveness half-life: 60 days since the last commit. */
const LIVENESS_HALF_LIFE_DAYS = 60;
/** Even a fully dead project keeps 30% weight — it may still be useful. */
const LIVENESS_FLOOR = 0.3;

export function computeScore(input: ScoreInput, now: Date = new Date()): ScoreBreakdown {
  const daysSincePush = input.pushedAt
    ? Math.max(0, (now.getTime() - input.pushedAt.getTime()) / 86_400_000)
    : null;

  // No commit data means "half alive", not "dead": never punish a project for a failed sync
  const decay =
    daysSincePush === null
      ? 0.5
      : Math.pow(0.5, daysSincePush / LIVENESS_HALF_LIFE_DAYS);
  const liveness = LIVENESS_FLOOR + (1 - LIVENESS_FLOOR) * decay;

  const parts = [
    { label: "Stars", value: 1.0 * ln(input.stars) },
    { label: "Forks", value: 0.5 * ln(input.forks) },
    { label: "Contributors", value: 0.9 * ln(input.contributors) },
    { label: "Release downloads", value: 0.4 * ln(input.releaseDownloads) },
    { label: "Catalog upvotes", value: 0.7 * ln(input.upvotes) },
    { label: "Catalog click-throughs", value: 0.3 * ln(input.clicks) },
  ];

  const popularity = parts.reduce((sum, p) => sum + p.value, 0);
  const momentum = 0.8 * ln(input.starsDelta7d);
  const score = (popularity + momentum) * liveness * 10;

  return {
    score: Math.round(score * 10) / 10,
    popularity: Math.round(popularity * 100) / 100,
    momentum: Math.round(momentum * 100) / 100,
    liveness: Math.round(liveness * 100) / 100,
    daysSincePush: daysSincePush === null ? null : Math.round(daysSincePush),
    parts: parts.map((p) => ({ ...p, value: Math.round(p.value * 100) / 100 })),
  };
}

/** Human-readable liveness label for the card badge. */
export function livenessLabel(daysSincePush: number | null): {
  label: string;
  tone: "good" | "warn" | "bad" | "unknown";
} {
  if (daysSincePush === null) return { label: "no data", tone: "unknown" };
  if (daysSincePush <= 14) return { label: "active", tone: "good" };
  if (daysSincePush <= 90) return { label: "maintained", tone: "good" };
  if (daysSincePush <= 270) return { label: "slowing", tone: "warn" };
  return { label: "abandoned", tone: "bad" };
}
