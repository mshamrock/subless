"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  contestEntries,
  contests,
  projectMetrics,
  projectTargets,
  projectUpvotes,
  projects,
  targets,
} from "@/lib/db/schema";
import { auth, getUserGithubToken, requireUser } from "@/lib/auth";
import {
  checkPublicRepo,
  listUserRepos,
  parseRepoUrl,
  verifyRepoOwnership,
  type UserRepo,
} from "@/lib/github";
import { canSubmitEntry } from "@/lib/cycle";
import { syncProject, recomputeScore } from "@/lib/sync";
import { ensureTargetIcon } from "@/lib/targets";
import { slugify } from "@/lib/utils";
import { toActionError, type ActionResult } from "./guard";

const submitSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  tagline: z.string().trim().min(10, "Describe the project in one line").max(160),
  description: z.string().trim().max(4000).optional(),
  repoUrl: z.string().trim().min(3, "Add a link to the repository"),
  homepageUrl: z.string().trim().url("That is not a valid URL").optional().or(z.literal("")),
  builtWith: z.string().trim().max(120).optional(),
  targetIds: z.array(z.coerce.number()).min(1, "Say what this is an alternative to"),
  /** Set when a builder arrives from a challenge page — publish and enter in one step. */
  challengeSlug: z.string().trim().max(120).optional(),
  newTargetName: z.string().trim().max(80).optional(),
  newTargetUrl: z.string().trim().max(200).optional(),
});

export interface SubmittedProject {
  slug: string;
  name: string;
  ownershipVerified: boolean;
  /** Title of the challenge this build was entered into, when it came from one. */
  enteredChallenge: string | null;
}

export async function submitProject(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<SubmittedProject>> {
  try {
    const user = await requireUser();

    const parsed = submitSchema.safeParse({
      name: formData.get("name"),
      tagline: formData.get("tagline"),
      description: formData.get("description") || undefined,
      repoUrl: formData.get("repoUrl"),
      homepageUrl: formData.get("homepageUrl") || "",
      builtWith: formData.get("builtWith") || undefined,
      targetIds: formData.getAll("targetIds").filter(Boolean),
      challengeSlug: formData.get("challengeSlug") || undefined,
      newTargetName: formData.get("newTargetName") || undefined,
      newTargetUrl: formData.get("newTargetUrl") || undefined,
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const data = parsed.data;

    const repo = parseRepoUrl(data.repoUrl);
    if (!repo) return { ok: false, error: "That does not look like a GitHub repository URL" };

    const canonicalRepoUrl = `https://github.com/${repo.fullName}`;
    const [dupe] = await db
      .select({ slug: projects.slug })
      .from(projects)
      .where(eq(projects.repoUrl, canonicalRepoUrl))
      .limit(1);
    if (dupe) return { ok: false, error: "This repository is already in the catalog" };

    const token = await getUserGithubToken(user.id);

    // The repository must exist and be publicly reachable before anything is
    // written. A made-up or private URL otherwise creates a permanent dead entry:
    // metrics can never load, so it sits in the catalog scoring zero forever.
    const check = await checkPublicRepo(repo.fullName, token ?? undefined);
    if (!check.ok) {
      const errors = {
        missing: `Repository github.com/${repo.fullName} does not exist. Check the URL for typos.`,
        private: `Repository github.com/${repo.fullName} is private. Make it public — the catalog only lists alternatives people can actually get.`,
        unavailable: `Could not reach GitHub to verify the repository${check.reason === "unavailable" && check.detail ? ` (${check.detail})` : ""}. Try again in a minute.`,
      } as const;
      return { ok: false, error: errors[check.reason] };
    }

    // Ownership is a separate question and never blocks a submission — people
    // may legitimately submit good alternatives they did not write. It only
    // decides whether the card earns a verified author badge.
    const ownershipVerified = token ? await verifyRepoOwnership(repo.fullName, token) : false;

    const targetIds = [...data.targetIds];

    // The service may be missing from the catalog — create it inline, moderation follows anyway
    if (data.newTargetName?.trim()) {
      const slug = slugify(data.newTargetName);
      const [existing] = await db.select().from(targets).where(eq(targets.slug, slug)).limit(1);
      if (existing) {
        targetIds.push(existing.id);
      } else {
        const [created] = await db
          .insert(targets)
          .values({ slug, name: data.newTargetName.trim(), websiteUrl: data.newTargetUrl || null })
          .returning();
        await ensureTargetIcon(created.id, slug, created.websiteUrl);
        targetIds.push(created.id);
      }
    }

    const slug = await uniqueProjectSlug(data.name);

    const [created] = await db
      .insert(projects)
      .values({
        slug,
        name: data.name,
        tagline: data.tagline,
        description: data.description ?? null,
        repoUrl: canonicalRepoUrl,
        repoFullName: repo.fullName,
        homepageUrl: data.homepageUrl || null,
        builtWith: data.builtWith ?? null,
        submittedById: user.id,
        ownershipVerified,
        status: "pending",
      })
      .returning();

    const uniqueTargets = [...new Set(targetIds)];
    if (uniqueTargets.length) {
      await db
        .insert(projectTargets)
        .values(uniqueTargets.map((targetId) => ({ projectId: created.id, targetId })));
    }

    // Pull metrics immediately so the project reaches moderation with real numbers
    await syncProject(created.id).catch(() => null);

    /**
     * Arriving from a challenge means the intent was to compete, so publishing
     * enters the build as well. Making someone publish, navigate back and submit
     * again was a pointless extra step at exactly the wrong moment.
     */
    let enteredChallenge: string | null = null;
    if (data.challengeSlug) {
      const [challenge] = await db
        .select()
        .from(contests)
        .where(eq(contests.slug, data.challengeSlug))
        .limit(1);

      if (challenge && canSubmitEntry(challenge.status)) {
        await db
          .insert(contestEntries)
          .values({ contestId: challenge.id, projectId: created.id, userId: user.id })
          .onConflictDoNothing();
        enteredChallenge = challenge.title;
        revalidatePath(`/challenges/${challenge.slug}`);
      }
    }

    revalidatePath("/catalog");
    revalidatePath("/admin");

    return {
      ok: true,
      data: {
        slug: created.slug,
        name: created.name,
        ownershipVerified,
        enteredChallenge,
      },
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleUpvote(projectId: number): Promise<ActionResult> {
  try {
    const user = await requireUser();

    const [existing] = await db
      .select()
      .from(projectUpvotes)
      .where(and(eq(projectUpvotes.projectId, projectId), eq(projectUpvotes.userId, user.id)))
      .limit(1);

    if (existing) {
      await db
        .delete(projectUpvotes)
        .where(and(eq(projectUpvotes.projectId, projectId), eq(projectUpvotes.userId, user.id)));
    } else {
      await db.insert(projectUpvotes).values({ projectId, userId: user.id });
    }

    await recomputeScore(projectId);
    revalidatePath("/catalog");
    revalidatePath("/leaderboard");
    return { ok: true, message: existing ? "Upvote removed" : "Upvote counted" };
  } catch (e) {
    return toActionError(e);
  }
}

/** Click counter — feeds the score with a small weight as a signal of real interest. */
export async function trackClick(projectId: number): Promise<void> {
  try {
    await db
      .insert(projectMetrics)
      .values({ projectId, clicks: 1 })
      .onConflictDoUpdate({
        target: projectMetrics.projectId,
        set: { clicks: sql`${projectMetrics.clicks} + 1` },
      });
  } catch {
    // A click is not critical — fail silently
  }
}

async function uniqueProjectSlug(name: string) {
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

export interface RepoOption extends UserRepo {
  /** Already in the catalog, so it cannot be submitted again. */
  alreadySubmitted: boolean;
}

/**
 * The signed-in person's repositories, annotated with what is already listed.
 *
 * Typing a URL asks someone to fetch something they already have open in another
 * tab. Their own repository list is the shortest path from "I built this" to a
 * filled-in form, and it removes the whole class of typo and wrong-owner errors.
 */
export async function listMyRepositories(): Promise<
  { ok: true; repos: RepoOption[] } | { ok: false; error: string }
> {
  try {
    const user = await requireUser();
    const token = await getUserGithubToken(user.id);
    if (!token) {
      return { ok: false, error: "Sign in with GitHub again to list your repositories" };
    }

    const repos = await listUserRepos(token);

    const taken = new Set(
      (await db.select({ repoUrl: projects.repoUrl }).from(projects)).map((r) =>
        r.repoUrl.toLowerCase(),
      ),
    );

    return {
      ok: true,
      repos: repos.map((r) => ({
        ...r,
        alreadySubmitted: taken.has(`https://github.com/${r.fullName}`.toLowerCase()),
      })),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg === "UNAUTHORIZED" ? "You need to sign in" : msg };
  }
}

export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}
