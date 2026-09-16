"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { switches, targets } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { yearlyPrice } from "@/lib/utils";
import { toActionError, type ActionResult } from "./guard";

export interface SwitchResult {
  active: boolean;
  annualUsd: number;
  targetName: string;
}

/**
 * Records — or takes back — "I went Subless on this".
 *
 * The annual price is snapshotted rather than joined at read time, so a vendor
 * changing its pricing later cannot retroactively rewrite what someone saved.
 */
export async function toggleSwitch(
  targetId: number,
  projectId?: number,
): Promise<ActionResult<SwitchResult>> {
  try {
    const user = await requireUser();

    const [target] = await db.select().from(targets).where(eq(targets.id, targetId)).limit(1);
    if (!target) return { ok: false, error: "Subscription not found" };

    const [existing] = await db
      .select()
      .from(switches)
      .where(and(eq(switches.userId, user.id), eq(switches.targetId, targetId)))
      .limit(1);

    const annualUsd = yearlyPrice(target.monthlyPriceUsd) ?? 0;

    if (existing) {
      await db.delete(switches).where(eq(switches.id, existing.id));
    } else {
      await db
        .insert(switches)
        .values({ userId: user.id, targetId, projectId: projectId ?? null, annualUsd });
    }

    revalidatePath("/");
    revalidatePath("/savings");
    revalidatePath(`/alternatives/${target.slug}`);

    return {
      ok: true,
      message: existing
        ? `Removed ${target.name} from your savings`
        : `You went Subless on ${target.name}`,
      data: { active: !existing, annualUsd, targetName: target.name },
    };
  } catch (e) {
    return toActionError(e);
  }
}
