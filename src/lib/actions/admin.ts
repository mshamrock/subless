"use server";

import { revalidatePath } from "next/cache";
import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  contests,
  cycleLog,
  nominationVotes,
  nominations,
  projectMetrics,
  projects,
  targets,
  users,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { runWeeklyTick, uniqueContestSlug } from "@/lib/cycle";
import { syncAllProjects } from "@/lib/sync";
import { sendWeeklyDigest } from "@/lib/email/weekly";
import { seedReferenceData } from "@/lib/seed-data";
import { seedCandidates } from "@/lib/seed-candidates";
import { backfillTargetIcons, ensureTarget, ensureTargetIcon } from "@/lib/targets";
import { slugify } from "@/lib/utils";
import { toActionError, type ActionResult } from "./guard";

export async function moderateProject(
  projectId: number,
  decision: "approved" | "rejected",
  reason?: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    await db
      .update(projects)
      .set({
        status: decision,
        rejectionReason: decision === "rejected" ? reason ?? null : null,
        approvedAt: decision === "approved" ? new Date() : null,
      })
      .where(eq(projects.id, projectId));

    revalidatePath("/admin");
    revalidatePath("/catalog");
    return { ok: true, message: decision === "approved" ? "Project published" : "Project rejected" };
  } catch (e) {
    return toActionError(e);
  }
}

export async function moderateNomination(
  nominationId: number,
  decision: "approved" | "rejected",
): Promise<ActionResult> {
  try {
    await requireAdmin();

    // Approval is the point a named service becomes vetted, so that is where it
    // earns a catalog row — and with it an icon everywhere it is mentioned
    if (decision === "approved") {
      const [nomination] = await db
        .select()
        .from(nominations)
        .where(eq(nominations.id, nominationId))
        .limit(1);

      if (nomination && !nomination.targetId) {
        const targetId = await ensureTarget({
          name: nomination.targetName,
          websiteUrl: nomination.targetUrl,
          monthlyPriceUsd: nomination.monthlyPriceUsd,
          description: nomination.pitch,
        });
        await db
          .update(nominations)
          .set({ targetId })
          .where(eq(nominations.id, nominationId));
      }
    }

    await db.update(nominations).set({ status: decision }).where(eq(nominations.id, nominationId));
    revalidatePath("/admin");
    revalidatePath("/wanted");
    return {
      ok: true,
      message:
        decision === "approved" ? "Nomination opened for voting" : "Nomination rejected",
    };
  } catch (e) {
    return toActionError(e);
  }
}

const contestSchema = z.object({
  title: z.string().trim().min(5, "Title is too short").max(120),
  brief: z.string().trim().min(20, "Describe what should come out of this").max(4000),
  requirements: z.string().trim().max(4000).optional(),
  targetId: z.coerce.number().optional(),
  newTargetName: z.string().trim().max(80).optional(),
  newTargetUrl: z.string().trim().max(200).optional(),
  monthlyPriceUsd: z.coerce.number().min(0).max(100000).optional(),
  startNow: z.coerce.boolean().optional(),
});

export async function createContest(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = contestSchema.safeParse({
      title: formData.get("title"),
      brief: formData.get("brief"),
      requirements: formData.get("requirements") || undefined,
      targetId: formData.get("targetId") || undefined,
      newTargetName: formData.get("newTargetName") || undefined,
      newTargetUrl: formData.get("newTargetUrl") || undefined,
      monthlyPriceUsd: formData.get("monthlyPriceUsd") || undefined,
      startNow: formData.get("startNow") === "on",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const data = parsed.data;

    let targetId = data.targetId || null;
    if (!targetId && data.newTargetName?.trim()) {
      const slug = slugify(data.newTargetName);
      const [existing] = await db.select().from(targets).where(eq(targets.slug, slug)).limit(1);
      if (existing) targetId = existing.id;
      else {
        const [created] = await db
          .insert(targets)
          .values({
            slug,
            name: data.newTargetName.trim(),
            websiteUrl: data.newTargetUrl || null,
            monthlyPriceUsd: data.monthlyPriceUsd ?? null,
          })
          .returning();
        await ensureTargetIcon(created.id, slug, created.websiteUrl);
        targetId = created.id;
      }
    }

    // Each line becomes one checklist item for voters
    const requirements = (data.requirements ?? "")
      .split("\n")
      .map((s) => s.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);

    // Only one contest may accept entries at a time, otherwise "this week"
    // stops meaning anything. A second one goes into the queue
    const [alreadyBuilding] = await db
      .select({ id: contests.id })
      .from(contests)
      .where(eq(contests.status, "building"))
      .limit(1);

    const startNow = data.startNow && !alreadyBuilding;
    const now = new Date();
    const WEEK = 7 * 86_400_000;

    const [maxPos] = await db
      .select({ max: sql<number>`coalesce(max(${contests.queuePosition}), 0)::int` })
      .from(contests)
      .where(eq(contests.status, "queued"));

    await db.insert(contests).values({
      slug: await uniqueContestSlug(data.title),
      title: data.title,
      brief: data.brief,
      requirements,
      targetId,
      status: startNow ? "building" : "queued",
      queuePosition: startNow ? 0 : (maxPos?.max ?? 0) + 1,
      buildingStartsAt: startNow ? now : null,
      votingStartsAt: startNow ? new Date(now.getTime() + WEEK) : null,
    });

    revalidatePath("/admin");
    revalidatePath("/challenges");
    revalidatePath("/");

    return {
      ok: true,
      message: startNow
        ? "Contest started — the build week is running"
        : alreadyBuilding && data.startNow
          ? "Another contest is already accepting entries, so this one was queued instead"
          : "Contest added to the queue",
    };
  } catch (e) {
    return toActionError(e);
  }
}

/** Manually run the weekly tick — for debugging, or when cron failed to fire. */
export async function advanceCycle(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const result = await runWeeklyTick("admin");
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/challenges");
    return { ok: true, message: result.events.join(" · ") };
  } catch (e) {
    return toActionError(e);
  }
}

export async function syncMetricsNow(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await syncAllProjects();
    revalidatePath("/leaderboard");
    revalidatePath("/catalog");
    revalidatePath("/admin");
    return {
      ok: true,
      message: `Synced ${r.ok} of ${r.total}${r.failed ? `, ${r.failed} failed: ${r.errors.join("; ")}` : ""}`,
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function fetchMissingIcons(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await backfillTargetIcons();

    revalidatePath("/");
    revalidatePath("/catalog");
    revalidatePath("/challenges");
    revalidatePath("/wanted");
    revalidatePath("/admin");

    const parts = [`Icons stored: ${r.stored} of ${r.scanned}`];
    if (r.nominationsLinked) parts.push(`nominations registered: ${r.nominationsLinked}`);
    if (r.failed.length) parts.push(`no usable icon: ${r.failed.join(", ")}`);

    return { ok: true, message: parts.join(" · ") };
  } catch (e) {
    return toActionError(e);
  }
}

export async function previewWeeklyDigest(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await sendWeeklyDigest();

    if (r.skipped) return { ok: true, message: `Nothing sent — ${r.skipped}` };

    const parts = [`${r.attempted} recipient(s)`];
    if (r.delivered) parts.push(`${r.delivered} delivered`);
    if (r.dryRun) parts.push(`${r.dryRun} logged to the server console (no RESEND_API_KEY)`);
    if (r.failed.length) parts.push(`failed: ${r.failed.join("; ")}`);

    return { ok: true, message: parts.join(" · ") };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Loads the reference catalog — categories, paid services and the open-source
 * alternatives already catalogued. Idempotent, so it is safe to press twice, and
 * available here so nobody needs a production connection string to run it.
 */
export async function seedReference(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await seedReferenceData();

    revalidatePath("/");
    revalidatePath("/catalog");
    revalidatePath("/wanted");
    revalidatePath("/admin");

    const parts: string[] = [];
    if (r.categories) parts.push(`${r.categories} categories`);
    if (r.services) parts.push(`${r.services} services`);
    if (r.alternatives) parts.push(`${r.alternatives} alternatives`);
    if (r.skipped) parts.push(`${r.skipped} already present`);

    return {
      ok: true,
      message: parts.length ? `Added ${parts.join(", ")}` : "Everything was already there",
    };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Loads the nomination candidate slate: services worth replacing, each with a
 * concrete note on what a usable replacement actually needs. Zero votes, no
 * author — a starting slate, not manufactured demand. Idempotent.
 */
export async function seedCandidateSlate(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await seedCandidates();

    revalidatePath("/");
    revalidatePath("/wanted");
    revalidatePath("/catalog");
    revalidatePath("/admin");

    const parts: string[] = [];
    if (r.nominations) parts.push(`${r.nominations} nominations`);
    if (r.services) parts.push(`${r.services} services`);
    if (r.categories) parts.push(`${r.categories} categories`);
    if (r.icons) parts.push(`${r.icons} icons`);
    if (r.skipped) parts.push(`${r.skipped} already nominated`);

    return {
      ok: true,
      message: parts.length ? `Added ${parts.join(", ")}` : "Everything was already there",
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function moveInQueue(contestId: number, direction: -1 | 1): Promise<ActionResult> {
  try {
    await requireAdmin();
    const queue = await db
      .select()
      .from(contests)
      .where(eq(contests.status, "queued"))
      .orderBy(asc(contests.queuePosition), asc(contests.id));

    const index = queue.findIndex((c) => c.id === contestId);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= queue.length) {
      return { ok: false, error: "Nowhere to move it" };
    }

    // Queue positions may have drifted — just renumber the whole list
    const reordered = [...queue];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
    for (let i = 0; i < reordered.length; i++) {
      await db
        .update(contests)
        .set({ queuePosition: i + 1 })
        .where(eq(contests.id, reordered[i].id));
    }

    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

/* ────────────────────────────────  Admin reads  ──────────────────────────────── */

/**
 * Everything an admin manages, searchable.
 *
 * Paged rather than complete: there are well over a hundred nominations, and a
 * moderation screen that renders all of them is slow to load and impossible to
 * scan. Search narrows; the count tells you what you are not seeing.
 */
export async function getManagedContent(q = "") {
  await requireAdmin();
  const needle = q.trim() ? `%${q.trim()}%` : null;

  const projectRows = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      name: projects.name,
      tagline: projects.tagline,
      status: projects.status,
      repoFullName: projects.repoFullName,
      authorLogin: users.githubLogin,
      stars: sql<number>`coalesce(${projectMetrics.stars}, 0)::int`,
    })
    .from(projects)
    .leftJoin(users, eq(users.id, projects.submittedById))
    .leftJoin(projectMetrics, eq(projectMetrics.projectId, projects.id))
    .where(needle ? or(ilike(projects.name, needle), ilike(projects.tagline, needle)) : undefined)
    .orderBy(asc(projects.status), desc(projects.createdAt))
    .limit(60);

  const nominationRows = await db
    .select({
      id: nominations.id,
      targetName: nominations.targetName,
      pitch: nominations.pitch,
      status: nominations.status,
      monthlyPriceUsd: nominations.monthlyPriceUsd,
      authorLogin: users.githubLogin,
      votes: sql<number>`count(${nominationVotes.userId})::int`,
    })
    .from(nominations)
    .leftJoin(users, eq(users.id, nominations.submittedById))
    .leftJoin(nominationVotes, eq(nominationVotes.nominationId, nominations.id))
    .where(
      needle
        ? or(ilike(nominations.targetName, needle), ilike(nominations.pitch, needle))
        : undefined,
    )
    .groupBy(nominations.id, users.id)
    .orderBy(desc(sql`count(${nominationVotes.userId})`), asc(nominations.targetName))
    .limit(60);

  const [projectTotal] = await db.select({ n: sql<number>`count(*)::int` }).from(projects);
  const [nominationTotal] = await db.select({ n: sql<number>`count(*)::int` }).from(nominations);

  return {
    projects: projectRows,
    nominations: nominationRows,
    projectTotal: projectTotal?.n ?? 0,
    nominationTotal: nominationTotal?.n ?? 0,
    query: q,
  };
}

export async function getAdminData() {
  await requireAdmin();

  const pendingProjects = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      name: projects.name,
      tagline: projects.tagline,
      repoUrl: projects.repoUrl,
      homepageUrl: projects.homepageUrl,
      builtWith: projects.builtWith,
      ownershipVerified: projects.ownershipVerified,
      createdAt: projects.createdAt,
      authorLogin: users.githubLogin,
      stars: sql<number>`coalesce(${projectMetrics.stars}, 0)::int`,
      syncError: projectMetrics.syncError,
    })
    .from(projects)
    .leftJoin(users, eq(users.id, projects.submittedById))
    .leftJoin(projectMetrics, eq(projectMetrics.projectId, projects.id))
    .where(eq(projects.status, "pending"))
    .orderBy(desc(projects.createdAt));

  const pendingNominations = await db
    .select({
      id: nominations.id,
      targetName: nominations.targetName,
      targetUrl: nominations.targetUrl,
      pitch: nominations.pitch,
      monthlyPriceUsd: nominations.monthlyPriceUsd,
      createdAt: nominations.createdAt,
      authorLogin: users.githubLogin,
    })
    .from(nominations)
    .leftJoin(users, eq(users.id, nominations.submittedById))
    .where(eq(nominations.status, "pending"))
    .orderBy(desc(nominations.createdAt));

  const queue = await db
    .select({
      id: contests.id,
      slug: contests.slug,
      title: contests.title,
      status: contests.status,
      queuePosition: contests.queuePosition,
      targetName: targets.name,
    })
    .from(contests)
    .leftJoin(targets, eq(targets.id, contests.targetId))
    .where(eq(contests.status, "queued"))
    .orderBy(asc(contests.queuePosition), asc(contests.id));

  const log = await db.select().from(cycleLog).orderBy(desc(cycleLog.ranAt)).limit(10);

  const targetList = await db
    .select({ id: targets.id, name: targets.name })
    .from(targets)
    .orderBy(asc(targets.name));

  return { pendingProjects, pendingNominations, queue, log, targetList };
}
