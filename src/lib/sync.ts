import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  githubDetails,
  githubStats,
  projectMetrics,
  projectUpvotes,
  projects,
} from "@/lib/db/schema";
import { fetchRepoDetails, fetchRepoSnapshot } from "@/lib/github";
import { computeScore } from "@/lib/score";

/**
 * Sync one project: GitHub snapshot → history row → score recompute.
 * A network error must not take down the whole run, so it lands in syncError
 * and the project stays in the catalog with its previous numbers.
 */
export async function syncProject(projectId: number): Promise<{ ok: boolean; error?: string }> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project?.repoFullName) {
    return { ok: false, error: "Project has no repository set" };
  }

  try {
    const snap = await fetchRepoSnapshot(project.repoFullName);

    const upvotes = await countUpvotes(projectId);
    const starsDelta7d = await starsDelta(projectId, snap.stars);
    const existing = await db
      .select({ clicks: projectMetrics.clicks })
      .from(projectMetrics)
      .where(eq(projectMetrics.projectId, projectId))
      .limit(1);
    const clicks = existing[0]?.clicks ?? 0;

    const breakdown = computeScore({
      stars: snap.stars,
      forks: snap.forks,
      contributors: snap.contributors,
      releaseDownloads: snap.releaseDownloads,
      upvotes,
      clicks,
      starsDelta7d,
      // An archived repo counts as dead regardless of its last push date
      pushedAt: snap.archived ? new Date(0) : snap.pushedAt,
    });

    await db.insert(githubStats).values({
      projectId,
      stars: snap.stars,
      forks: snap.forks,
      watchers: snap.watchers,
      openIssues: snap.openIssues,
      contributors: snap.contributors,
      releaseDownloads: snap.releaseDownloads,
      pushedAt: snap.pushedAt,
      score: breakdown.score,
    });

    const row = {
      stars: snap.stars,
      forks: snap.forks,
      contributors: snap.contributors,
      releaseDownloads: snap.releaseDownloads,
      pushedAt: snap.pushedAt,
      starsDelta7d,
      upvotes,
      clicks,
      score: breakdown.score,
      syncedAt: new Date(),
      syncError: null as string | null,
    };

    await db
      .insert(projectMetrics)
      .values({ projectId, ...row })
      .onConflictDoUpdate({ target: projectMetrics.projectId, set: row });

    // Backfill facts the repository already declares, but never overwrite what
    // the author entered by hand — their value is the more deliberate one.
    const backfill: Partial<typeof projects.$inferInsert> = {};
    if (snap.licenseSpdx && !project.licenseSpdx) backfill.licenseSpdx = snap.licenseSpdx;
    if (snap.homepage && !project.homepageUrl) backfill.homepageUrl = snap.homepage;

    if (Object.keys(backfill).length) {
      await db.update(projects).set(backfill).where(eq(projects.id, projectId));
    }

    /**
     * Insights are a separate, best-effort pass. They cost several extra calls
     * and nothing downstream sorts by them, so a failure here must not mark the
     * whole project as unsynced — the numbers people rank by are already saved.
     */
    try {
      const details = await fetchRepoDetails(project.repoFullName);
      const detailRow = {
        selfHost: details.selfHost,
        commitWeeks: details.commitWeeks,
        release: details.release,
        contributors: details.contributors,
        topContributorShare: details.topContributorShare,
        goodFirstIssues: details.goodFirstIssues,
        fetchedAt: new Date(),
      };
      await db
        .insert(githubDetails)
        .values({ projectId, ...detailRow })
        .onConflictDoUpdate({ target: githubDetails.projectId, set: detailRow });
    } catch {
      // Keep whatever was stored last time rather than blanking the section
    }

    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db
      .insert(projectMetrics)
      .values({ projectId, syncError: error, syncedAt: new Date() })
      .onConflictDoUpdate({
        target: projectMetrics.projectId,
        set: { syncError: error, syncedAt: new Date() },
      });
    return { ok: false, error };
  }
}

/** Run across all approved projects. Sequential — GitHub dislikes bursts. */
export async function syncAllProjects(limit = 200) {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.status, "approved"))
    .limit(limit);

  const results = { total: rows.length, ok: 0, failed: 0, errors: [] as string[] };
  for (const { id } of rows) {
    const r = await syncProject(id);
    if (r.ok) results.ok++;
    else {
      results.failed++;
      if (r.error && results.errors.length < 10) results.errors.push(`#${id}: ${r.error}`);
    }
  }
  return results;
}

async function countUpvotes(projectId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(projectUpvotes)
    .where(eq(projectUpvotes.projectId, projectId));
  return row?.n ?? 0;
}

/** Weekly star delta: current value minus the nearest snapshot 7+ days old. */
async function starsDelta(projectId: number, currentStars: number): Promise<number> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [old] = await db
    .select({ stars: githubStats.stars })
    .from(githubStats)
    .where(and(eq(githubStats.projectId, projectId), lt(githubStats.fetchedAt, weekAgo)))
    .orderBy(desc(githubStats.fetchedAt))
    .limit(1);
  if (!old) return 0;
  return Math.max(0, currentStars - old.stars);
}

/** Recompute the score without hitting GitHub — after an upvote or a click. */
export async function recomputeScore(projectId: number) {
  const [m] = await db
    .select()
    .from(projectMetrics)
    .where(eq(projectMetrics.projectId, projectId))
    .limit(1);
  if (!m) return;

  const upvotes = await countUpvotes(projectId);
  const breakdown = computeScore({
    stars: m.stars,
    forks: m.forks,
    contributors: m.contributors,
    releaseDownloads: m.releaseDownloads,
    upvotes,
    clicks: m.clicks,
    starsDelta7d: m.starsDelta7d,
    pushedAt: m.pushedAt,
  });

  await db
    .update(projectMetrics)
    .set({ upvotes, score: breakdown.score })
    .where(eq(projectMetrics.projectId, projectId));
}
