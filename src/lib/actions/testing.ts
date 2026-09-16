"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { contestEntries, contests, testReports } from "@/lib/db/schema";
import { auth, requireUser } from "@/lib/auth";
import { toActionError, type ActionResult } from "./guard";

const noteSchema = z.string().trim().max(2000).optional();

/**
 * Records one person's verdict on one build, checked against the challenge's own
 * requirements.
 *
 * Testing your own entry is blocked for the same reason voting for it is: a
 * builder marking their own checklist complete is not evidence, and the number
 * it produces would be read as though it were.
 */
export async function submitTestReport(
  entryId: number,
  met: boolean[],
  note?: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();

    const parsedNote = noteSchema.safeParse(note);
    if (!parsedNote.success) return { ok: false, error: "That note is too long" };

    const [entry] = await db
      .select({
        id: contestEntries.id,
        userId: contestEntries.userId,
        contestSlug: contests.slug,
        requirements: contests.requirements,
      })
      .from(contestEntries)
      .innerJoin(contests, eq(contests.id, contestEntries.contestId))
      .where(eq(contestEntries.id, entryId))
      .limit(1);

    if (!entry) return { ok: false, error: "Entry not found" };
    if (entry.userId === user.id) {
      return { ok: false, error: "You cannot test your own build" };
    }
    if (entry.requirements.length === 0) {
      return { ok: false, error: "This challenge has no requirements to test against" };
    }
    if (met.length !== entry.requirements.length) {
      // The admin edited the list while this form was open
      return { ok: false, error: "The requirements changed — reload and try again" };
    }

    const items = entry.requirements.map((requirement, i) => ({
      requirement,
      met: Boolean(met[i]),
    }));

    const [existing] = await db
      .select({ id: testReports.id })
      .from(testReports)
      .where(and(eq(testReports.entryId, entryId), eq(testReports.userId, user.id)))
      .limit(1);

    if (existing) {
      await db
        .update(testReports)
        .set({ items, note: parsedNote.data || null, updatedAt: new Date() })
        .where(eq(testReports.id, existing.id));
    } else {
      await db
        .insert(testReports)
        .values({ entryId, userId: user.id, items, note: parsedNote.data || null });
    }

    revalidatePath(`/challenges/${entry.contestSlug}`);
    return {
      ok: true,
      message: existing ? "Your report was updated" : "Thanks — your report is in",
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteTestReport(entryId: number): Promise<ActionResult> {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id) return { ok: false, error: "You need to sign in" };

    await db
      .delete(testReports)
      .where(and(eq(testReports.entryId, entryId), eq(testReports.userId, user.id)));

    revalidatePath("/challenges", "layout");
    return { ok: true, message: "Report removed" };
  } catch (e) {
    return toActionError(e);
  }
}
