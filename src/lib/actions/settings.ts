"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { toActionError, type ActionResult } from "./guard";

export async function setEmailOptIn(optIn: boolean): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await db.update(users).set({ emailOptIn: optIn }).where(eq(users.id, user.id));

    revalidatePath("/settings");
    return {
      ok: true,
      message: optIn ? "Emails are on" : "Emails are off",
    };
  } catch (e) {
    return toActionError(e);
  }
}
