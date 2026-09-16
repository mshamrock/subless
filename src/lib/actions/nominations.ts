"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { nominationVotes, nominations, targets } from "@/lib/db/schema";
import { auth, requireUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { checkVotingEligibility, toActionError, type ActionResult } from "./guard";

const nominationSchema = z.object({
  targetName: z.string().trim().min(2, "Name the service").max(80),
  targetUrl: z.string().trim().url("That is not a valid URL").optional().or(z.literal("")),
  pitch: z.string().trim().min(20, "Say more about why this is worth cloning").max(1000),
  monthlyPriceUsd: z.coerce.number().min(0).max(100000).optional(),
});

export async function createNomination(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();

    const parsed = nominationSchema.safeParse({
      targetName: formData.get("targetName"),
      targetUrl: formData.get("targetUrl") || "",
      pitch: formData.get("pitch"),
      monthlyPriceUsd: formData.get("monthlyPriceUsd") || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

    const data = parsed.data;
    const slug = slugify(data.targetName);
    const [existingTarget] = await db
      .select()
      .from(targets)
      .where(eq(targets.slug, slug))
      .limit(1);

    await db.insert(nominations).values({
      targetId: existingTarget?.id ?? null,
      targetName: data.targetName,
      targetUrl: data.targetUrl || null,
      pitch: data.pitch,
      monthlyPriceUsd: data.monthlyPriceUsd ?? null,
      submittedById: user.id,
      status: "pending",
    });

    revalidatePath("/wanted");
    revalidatePath("/admin");
    return { ok: true, message: "Nomination submitted — it appears in the list once an admin reviews it" };
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleNominationVote(nominationId: number): Promise<ActionResult> {
  try {
    const session = await auth();
    const eligible = checkVotingEligibility(session?.user);
    if (!eligible.ok) return eligible;
    const userId = session!.user!.id;

    const [nomination] = await db
      .select()
      .from(nominations)
      .where(eq(nominations.id, nominationId))
      .limit(1);
    if (!nomination) return { ok: false, error: "Nomination not found" };
    if (nomination.status !== "approved") {
      return { ok: false, error: "This nomination is not open for voting yet" };
    }

    const [existing] = await db
      .select()
      .from(nominationVotes)
      .where(
        and(
          eq(nominationVotes.nominationId, nominationId),
          eq(nominationVotes.userId, userId),
        ),
      )
      .limit(1);

    // Unlike a contest, people may spread as many votes as they like here: this
    // measures demand rather than picking a winner
    if (existing) {
      await db
        .delete(nominationVotes)
        .where(
          and(
            eq(nominationVotes.nominationId, nominationId),
            eq(nominationVotes.userId, userId),
          ),
        );
    } else {
      await db.insert(nominationVotes).values({ nominationId, userId });
    }

    revalidatePath("/wanted");
    revalidatePath("/");
    return { ok: true, message: existing ? "Vote removed" : "Vote counted" };
  } catch (e) {
    return toActionError(e);
  }
}
