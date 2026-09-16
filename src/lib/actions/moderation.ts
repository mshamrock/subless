"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  comments,
  contestEntries,
  nominationVotes,
  nominations,
  projectTargets,
  projectUpvotes,
  projects,
  switches,
  targets,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { checkPublicRepo, parseRepoUrl } from "@/lib/github";
import { ensureTarget } from "@/lib/targets";
import { syncProject } from "@/lib/sync";
import { slugify } from "@/lib/utils";
import { toActionError, type ActionResult } from "./guard";

/* ────────────────────────────  Alternatives  ──────────────────────────── */

export async function setProjectStatus(
  projectId: number,
  status: "approved" | "hidden" | "rejected",
  reason?: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) return { ok: false, error: "Not found" };

    await db
      .update(projects)
      .set({
        status,
        rejectionReason: status === "approved" ? null : reason ?? project.rejectionReason,
        approvedAt: status === "approved" ? project.approvedAt ?? new Date() : project.approvedAt,
      })
      .where(eq(projects.id, projectId));

    revalidatePath("/admin");
    revalidatePath("/catalog");
    revalidatePath(`/projects/${project.slug}`);

    const verb = { approved: "visible", hidden: "hidden", rejected: "rejected" }[status];
    return { ok: true, message: `${project.name} is now ${verb}` };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * What a delete would destroy, so the confirmation can say it out loud.
 * Counting first costs a round trip and buys back the one thing a hard delete
 * cannot: the chance to change your mind while the data still exists.
 */
export async function projectDeletionImpact(projectId: number) {
  await requireAdmin();
  const [c] = await db
    .select({ n: count() })
    .from(comments)
    .where(and(eq(comments.subjectType, "project"), eq(comments.subjectId, projectId)));
  const [e] = await db
    .select({ n: count() })
    .from(contestEntries)
    .where(eq(contestEntries.projectId, projectId));
  const [u] = await db
    .select({ n: count() })
    .from(projectUpvotes)
    .where(eq(projectUpvotes.projectId, projectId));
  const [s] = await db
    .select({ n: count() })
    .from(switches)
    .where(eq(switches.projectId, projectId));

  return {
    comments: c?.n ?? 0,
    challengeEntries: e?.n ?? 0,
    upvotes: u?.n ?? 0,
    recordedSwitches: s?.n ?? 0,
  };
}

export async function deleteProject(projectId: number): Promise<ActionResult> {
  try {
    await requireAdmin();
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) return { ok: false, error: "Not found" };

    // Comments are polymorphic, so no foreign key removes them with the project
    await db
      .delete(comments)
      .where(and(eq(comments.subjectType, "project"), eq(comments.subjectId, projectId)));
    await db.delete(projectTargets).where(eq(projectTargets.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));

    revalidatePath("/admin");
    revalidatePath("/catalog");
    revalidatePath("/leaderboard");
    return { ok: true, message: `Deleted ${project.name}` };
  } catch (e) {
    return toActionError(e);
  }
}

const adminProjectSchema = z.object({
  repoUrl: z.string().trim().min(3, "Add a repository URL"),
  name: z.string().trim().max(80).optional(),
  tagline: z.string().trim().max(160).optional(),
  targetIds: z.array(z.coerce.number()).min(1, "Say what this replaces"),
});

/** Admin-added alternative: published immediately, with no claimed author. */
export async function addProjectAsAdmin(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = adminProjectSchema.safeParse({
      repoUrl: formData.get("repoUrl"),
      name: formData.get("name") || undefined,
      tagline: formData.get("tagline") || undefined,
      targetIds: formData.getAll("targetIds").filter(Boolean),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

    const repo = parseRepoUrl(parsed.data.repoUrl);
    if (!repo) return { ok: false, error: "That is not a GitHub repository URL" };

    const repoUrl = `https://github.com/${repo.fullName}`;
    const [dupe] = await db.select().from(projects).where(eq(projects.repoUrl, repoUrl)).limit(1);
    if (dupe) return { ok: false, error: "That repository is already listed" };

    const check = await checkPublicRepo(repo.fullName);
    if (!check.ok) {
      return {
        ok: false,
        error:
          check.reason === "missing"
            ? "That repository does not exist"
            : check.reason === "private"
              ? "That repository is private"
              : "Could not reach GitHub — try again",
      };
    }

    const name = parsed.data.name?.trim() || repo.repo;
    const [created] = await db
      .insert(projects)
      .values({
        slug: await uniqueSlug(name),
        name,
        tagline: parsed.data.tagline?.trim() || check.snapshot.description || name,
        repoUrl,
        repoFullName: repo.fullName,
        homepageUrl: check.snapshot.homepage,
        status: "approved",
        approvedAt: new Date(),
        submittedById: null,
      })
      .returning();

    await db
      .insert(projectTargets)
      .values(parsed.data.targetIds.map((targetId) => ({ projectId: created.id, targetId })));

    await syncProject(created.id).catch(() => null);

    revalidatePath("/admin");
    revalidatePath("/catalog");
    return { ok: true, message: `Added ${name}` };
  } catch (e) {
    return toActionError(e);
  }
}

/* ────────────────────────────  Nominations  ──────────────────────────── */

export async function setNominationStatus(
  nominationId: number,
  status: "approved" | "hidden" | "rejected",
): Promise<ActionResult> {
  try {
    await requireAdmin();
    await db.update(nominations).set({ status }).where(eq(nominations.id, nominationId));

    revalidatePath("/admin");
    revalidatePath("/wanted");
    revalidatePath("/");
    return { ok: true, message: `Nomination is now ${status}` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteNomination(nominationId: number): Promise<ActionResult> {
  try {
    await requireAdmin();
    const [nomination] = await db
      .select()
      .from(nominations)
      .where(eq(nominations.id, nominationId))
      .limit(1);
    if (!nomination) return { ok: false, error: "Not found" };

    await db.delete(nominationVotes).where(eq(nominationVotes.nominationId, nominationId));
    await db.delete(nominations).where(eq(nominations.id, nominationId));

    revalidatePath("/admin");
    revalidatePath("/wanted");
    return { ok: true, message: `Deleted ${nomination.targetName}` };
  } catch (e) {
    return toActionError(e);
  }
}

const adminNominationSchema = z.object({
  targetName: z.string().trim().min(2, "Name the subscription").max(80),
  targetUrl: z.string().trim().url("That is not a valid URL").optional().or(z.literal("")),
  pitch: z.string().trim().min(20, "Say what a replacement actually needs").max(1000),
  monthlyPriceUsd: z.coerce.number().min(0).max(100000).optional(),
});

/** Admin-added nomination: approved immediately, still with zero votes. */
export async function addNominationAsAdmin(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = adminNominationSchema.safeParse({
      targetName: formData.get("targetName"),
      targetUrl: formData.get("targetUrl") || "",
      pitch: formData.get("pitch"),
      monthlyPriceUsd: formData.get("monthlyPriceUsd") || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const data = parsed.data;

    const targetId = await ensureTarget({
      name: data.targetName,
      websiteUrl: data.targetUrl || null,
      monthlyPriceUsd: data.monthlyPriceUsd ?? null,
      description: data.pitch,
    });

    const [existing] = await db
      .select()
      .from(nominations)
      .where(eq(nominations.targetId, targetId))
      .limit(1);
    if (existing) return { ok: false, error: `${data.targetName} is already nominated` };

    await db.insert(nominations).values({
      targetId,
      targetName: data.targetName,
      targetUrl: data.targetUrl || null,
      pitch: data.pitch,
      monthlyPriceUsd: data.monthlyPriceUsd ?? null,
      // Votes stay at zero. An admin adding a candidate is not demand either.
      submittedById: null,
      status: "approved",
    });

    revalidatePath("/admin");
    revalidatePath("/wanted");
    return { ok: true, message: `Added ${data.targetName}` };
  } catch (e) {
    return toActionError(e);
  }
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || "project";
  let slug = base;
  let n = 2;
  while (
    (await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).limit(1))
      .length
  ) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export async function listTargetsForAdmin() {
  await requireAdmin();
  return db.select({ id: targets.id, name: targets.name }).from(targets).orderBy(targets.name);
}
