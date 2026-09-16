"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contestEntries, contestVotes, contests, projects } from "@/lib/db/schema";
import { auth, requireUser } from "@/lib/auth";
import { canSubmitEntry, canVote } from "@/lib/cycle";
import { checkVotingEligibility, toActionError, type ActionResult } from "./guard";

/** Enter a project into this week's contest. */
export async function submitEntry(
  contestId: number,
  projectId: number,
  note: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();

    const [contest] = await db.select().from(contests).where(eq(contests.id, contestId)).limit(1);
    if (!contest) return { ok: false, error: "Contest not found" };
    if (!canSubmitEntry(contest.status)) {
      return {
        ok: false,
        error:
          contest.status === "voting"
            ? "Entries are closed — voting is underway"
            : "This contest is not accepting entries",
      };
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) return { ok: false, error: "Project not found" };
    if (project.submittedById !== user.id) {
      return { ok: false, error: "You can only enter your own project" };
    }

    const [dupe] = await db
      .select()
      .from(contestEntries)
      .where(
        and(eq(contestEntries.contestId, contestId), eq(contestEntries.projectId, projectId)),
      )
      .limit(1);
    if (dupe) return { ok: false, error: "This project has already been entered" };

    await db.insert(contestEntries).values({
      contestId,
      projectId,
      userId: user.id,
      note: note.trim() || null,
    });

    revalidatePath(`/challenges/${contest.slug}`);
    revalidatePath("/");
    return { ok: true, message: "Entry accepted" };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Vote for an entry. One vote per person per contest: calling this again moves
 * the vote to another entry, and clicking the current one removes it.
 */
export async function voteForEntry(contestId: number, entryId: number): Promise<ActionResult> {
  try {
    const session = await auth();
    const eligible = checkVotingEligibility(session?.user);
    if (!eligible.ok) return eligible;
    const userId = session!.user!.id;

    const [contest] = await db.select().from(contests).where(eq(contests.id, contestId)).limit(1);
    if (!contest) return { ok: false, error: "Contest not found" };
    if (!canVote(contest.status)) {
      return {
        ok: false,
        error:
          contest.status === "building"
            ? "Voting opens once the build week ends"
            : "Voting is closed for this contest",
      };
    }

    const [entry] = await db
      .select()
      .from(contestEntries)
      .where(and(eq(contestEntries.id, entryId), eq(contestEntries.contestId, contestId)))
      .limit(1);
    if (!entry) return { ok: false, error: "Entry not found" };

    // No self-voting, otherwise every participant starts one vote ahead
    if (entry.userId === userId) {
      return { ok: false, error: "You cannot vote for your own entry" };
    }

    const [existing] = await db
      .select()
      .from(contestVotes)
      .where(and(eq(contestVotes.contestId, contestId), eq(contestVotes.userId, userId)))
      .limit(1);

    let message: string;
    if (!existing) {
      await db.insert(contestVotes).values({ contestId, userId, entryId });
      message = "Vote counted";
    } else if (existing.entryId === entryId) {
      await db
        .delete(contestVotes)
        .where(and(eq(contestVotes.contestId, contestId), eq(contestVotes.userId, userId)));
      message = "Vote removed";
    } else {
      await db
        .update(contestVotes)
        .set({ entryId, createdAt: new Date() })
        .where(and(eq(contestVotes.contestId, contestId), eq(contestVotes.userId, userId)));
      message = "Vote moved";
    }

    revalidatePath(`/challenges/${contest.slug}`);
    revalidatePath("/");
    return { ok: true, message };
  } catch (e) {
    return toActionError(e);
  }
}
