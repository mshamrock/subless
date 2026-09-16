import { describe, expect, it } from "vitest";
import { computeScore, livenessLabel, type ScoreInput } from "@/lib/score";

const base: ScoreInput = {
  stars: 0, forks: 0, contributors: 0, releaseDownloads: 0,
  upvotes: 0, clicks: 0, starsDelta7d: 0, pushedAt: new Date(),
};

const NOW = new Date("2026-09-16T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("computeScore", () => {
  it("ranks a living project above a much bigger dead one", () => {
    // The formula's entire reason for existing: an abandoned repo is not an
    // alternative, however many stars it accumulated
    const dead = computeScore({ ...base, stars: 100_000, pushedAt: daysAgo(720) }, NOW);
    const alive = computeScore({ ...base, stars: 400, pushedAt: daysAgo(1) }, NOW);
    expect(alive.score).toBeGreaterThan(dead.score);
  });

  it("keeps liveness between the floor and 1", () => {
    const fresh = computeScore({ ...base, stars: 10, pushedAt: NOW }, NOW);
    const ancient = computeScore({ ...base, stars: 10, pushedAt: daysAgo(10_000) }, NOW);
    expect(fresh.liveness).toBeCloseTo(1, 2);
    expect(ancient.liveness).toBeCloseTo(0.3, 2);
  });

  it("halves liveness decay every 60 days", () => {
    const now = computeScore({ ...base, pushedAt: NOW }, NOW);
    const later = computeScore({ ...base, pushedAt: daysAgo(60) }, NOW);
    // 0.3 + 0.7*1 = 1.0 versus 0.3 + 0.7*0.5 = 0.65
    expect(now.liveness).toBeCloseTo(1, 2);
    expect(later.liveness).toBeCloseTo(0.65, 2);
  });

  it("treats missing commit data as half alive rather than dead", () => {
    // A failed sync must not look like abandonment
    const unknown = computeScore({ ...base, stars: 100, pushedAt: null }, NOW);
    expect(unknown.liveness).toBeGreaterThan(0.3);
    expect(unknown.daysSincePush).toBeNull();
  });

  it("dampens a single breakout so it cannot flatten the table", () => {
    const big = computeScore({ ...base, stars: 200_000, pushedAt: NOW }, NOW);
    const small = computeScore({ ...base, stars: 200, pushedAt: NOW }, NOW);
    // 1000x the stars must not mean anything close to 1000x the score
    expect(big.score / small.score).toBeLessThan(3);
  });

  it("gives every popularity term a visible breakdown that sums to the subtotal", () => {
    const r = computeScore(
      { ...base, stars: 50, forks: 10, contributors: 5, releaseDownloads: 100, upvotes: 3, clicks: 7, pushedAt: NOW },
      NOW,
    );
    const summed = r.parts.reduce((s, p) => s + p.value, 0);
    expect(summed).toBeCloseTo(r.popularity, 1);
    expect(r.parts).toHaveLength(6);
  });

  it("never returns a negative score", () => {
    expect(computeScore({ ...base, pushedAt: daysAgo(5000) }, NOW).score).toBeGreaterThanOrEqual(0);
  });
});

describe("livenessLabel", () => {
  it("labels by how long ago the last commit was", () => {
    expect(livenessLabel(3).tone).toBe("good");
    expect(livenessLabel(60).label).toBe("maintained");
    expect(livenessLabel(200).tone).toBe("warn");
    expect(livenessLabel(400).tone).toBe("bad");
    expect(livenessLabel(null).tone).toBe("unknown");
  });
});
