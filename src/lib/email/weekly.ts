import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, users } from "@/lib/db/schema";
import { getWeeklyState } from "@/lib/cycle";
import { resolveRecipient } from "./recipients";
import { sendAll } from "./send";
import { weeklyEmail } from "./templates";

/**
 * The weekly digest — the product's only heartbeat outside the site.
 *
 * A weekly cadence is worthless if nobody is told the week turned: voting opens
 * and closes whether or not anyone noticed. This runs right after the tick, with
 * the state the tick has just produced.
 */
export async function sendWeeklyDigest() {
  const state = await getWeeklyState();

  let winner: { challenge: string; project: string; slug: string } | null = null;
  if (state.finished?.winnerProjectId) {
    const [row] = await db
      .select({ name: projects.name, slug: projects.slug })
      .from(projects)
      .where(eq(projects.id, state.finished.winnerProjectId))
      .limit(1);
    if (row) {
      winner = { challenge: state.finished.title, project: row.name, slug: row.slug };
    }
  }

  // Nothing to announce is a reason to stay quiet, not to send an empty email
  if (!winner && !state.voting && !state.building) {
    return { attempted: 0, delivered: 0, dryRun: 0, failed: [], skipped: "nothing to announce" };
  }

  const audience = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.emailOptIn, true), isNotNull(users.email)));

  const emails = [];
  for (const person of audience) {
    const recipient = await resolveRecipient(person.id);
    if (!recipient) continue;
    emails.push(
      weeklyEmail({
        to: recipient.email,
        building: state.building ?? null,
        voting: state.voting ?? null,
        winner,
        unsubscribeUrl: recipient.unsubscribeUrl,
      }),
    );
  }

  return { ...(await sendAll(emails)), skipped: null };
}
