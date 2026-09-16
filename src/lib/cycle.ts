import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contests,
  contestEntries,
  contestVotes,
  cycleLog,
  nominations,
  nominationVotes,
  targets,
} from "@/lib/db/schema";
import { ensureTargetIcon } from "@/lib/targets";
import { slugify } from "@/lib/utils";

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The weekly tick. Exactly two visible events per week, by design: a new
 * contest opens and the previous vote is settled.
 *
 * Internally it shifts the pipeline one step, always in this order:
 *
 *   finished → archived        free up the homepage
 *   voting   → finished        tally votes, lock in the winner
 *   building → voting          entries closed, open voting
 *   queued   → building        this week's new topic
 *
 * Order matters: moving `building` first would let it skip two phases in one
 * tick. This is deliberately not idempotent — cron runs it once a week, and a
 * manual re-run from the admin panel is an intentional act that gets logged.
 */
export async function runWeeklyTick(trigger: "cron" | "admin" = "cron") {
  const now = new Date();
  const events: string[] = [];

  // 1. Last week's winner leaves the homepage
  const finished = await db
    .select()
    .from(contests)
    .where(eq(contests.status, "finished"));
  for (const c of finished) {
    await db.update(contests).set({ status: "archived" }).where(eq(contests.id, c.id));
    events.push(`Archived contest "${c.title}"`);
  }

  // 2. Voting closes and a winner is determined
  const [voting] = await db
    .select()
    .from(contests)
    .where(eq(contests.status, "voting"))
    .limit(1);

  if (voting) {
    const tally = await tallyContest(voting.id);
    for (const row of tally) {
      await db
        .update(contestEntries)
        .set({ finalVotes: row.votes, rank: row.rank })
        .where(eq(contestEntries.id, row.entryId));
    }
    const winner = tally[0];
    await db
      .update(contests)
      .set({
        status: "finished",
        endsAt: now,
        winnerProjectId: winner?.projectId ?? null,
      })
      .where(eq(contests.id, voting.id));

    events.push(
      winner
        ? `Results for "${voting.title}": project #${winner.projectId} won with ${winner.votes} vote(s) across ${tally.length} entries`
        : `Results for "${voting.title}": no entries, no winner`,
    );
  }

  // 3. The build week is over — open voting
  const [building] = await db
    .select()
    .from(contests)
    .where(eq(contests.status, "building"))
    .limit(1);

  if (building) {
    await db
      .update(contests)
      .set({ status: "voting", votingStartsAt: now, endsAt: new Date(now.getTime() + WEEK_MS) })
      .where(eq(contests.id, building.id));
    events.push(`Voting opened: "${building.title}"`);
  }

  // 4. This week's new topic. If the queue is empty, take the leading nomination
  let [next] = await db
    .select()
    .from(contests)
    .where(eq(contests.status, "queued"))
    .orderBy(asc(contests.queuePosition), asc(contests.id))
    .limit(1);

  if (!next) {
    const promoted = await promoteTopNomination();
    if (promoted) {
      next = promoted;
      events.push(`Queue was empty — topic promoted from nominations: "${promoted.title}"`);
    }
  }

  if (next) {
    await db
      .update(contests)
      .set({
        status: "building",
        buildingStartsAt: now,
        votingStartsAt: new Date(now.getTime() + WEEK_MS),
      })
      .where(eq(contests.id, next.id));
    events.push(`Contest started: "${next.title}"`);
  } else {
    events.push("No contests queued — nothing started this week");
  }

  const summary = events.join("; ");
  await db.insert(cycleLog).values({
    trigger,
    summary,
    details: JSON.stringify(events),
    ranAt: now,
  });

  return { at: now, events };
}

/** Tally votes with a stable ordering on ties. */
export async function tallyContest(contestId: number) {
  const rows = await db
    .select({
      entryId: contestEntries.id,
      projectId: contestEntries.projectId,
      createdAt: contestEntries.createdAt,
      votes: sql<number>`count(${contestVotes.userId})::int`,
    })
    .from(contestEntries)
    .leftJoin(contestVotes, eq(contestVotes.entryId, contestEntries.id))
    .where(eq(contestEntries.contestId, contestId))
    .groupBy(contestEntries.id, contestEntries.projectId, contestEntries.createdAt)
    .orderBy(desc(sql`count(${contestVotes.userId})`), asc(contestEntries.createdAt));

  // On equal votes the earlier submission wins: deterministic, and it rewards
  // people who did not sit on their entry until the deadline
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Records that a contest came from a nomination.
 *
 * The link goes both ways on purpose: the contest remembers what the community
 * asked for, and the nomination stops appearing on /wanted as something still
 * waiting to happen. Whoever creates the contest — the weekly tick or an admin
 * by hand — has to leave the same trail, so both go through here.
 */
export async function attachNominationToContest(contestId: number, nominationId: number) {
  await db
    .update(contests)
    .set({ originNominationId: nominationId })
    .where(eq(contests.id, contestId));

  await db
    .update(nominations)
    .set({ status: "promoted", promotedContestId: contestId })
    .where(eq(nominations.id, nominationId));
}

/** Turn the most-voted approved nomination into a contest. */
async function promoteTopNomination() {
  const [top] = await db
    .select({
      id: nominations.id,
      targetId: nominations.targetId,
      targetName: nominations.targetName,
      targetUrl: nominations.targetUrl,
      pitch: nominations.pitch,
      monthlyPriceUsd: nominations.monthlyPriceUsd,
      votes: sql<number>`count(${nominationVotes.userId})::int`,
    })
    .from(nominations)
    .leftJoin(nominationVotes, eq(nominationVotes.nominationId, nominations.id))
    .where(eq(nominations.status, "approved"))
    .groupBy(nominations.id)
    .orderBy(desc(sql`count(${nominationVotes.userId})`), asc(nominations.id))
    .limit(1);

  if (!top) return null;

  // The nomination may point at a service that is not in the catalog yet
  let targetId = top.targetId;
  if (!targetId) {
    const slug = slugify(top.targetName);
    const [existing] = await db.select().from(targets).where(eq(targets.slug, slug)).limit(1);
    if (existing) {
      targetId = existing.id;
    } else {
      const [created] = await db
        .insert(targets)
        .values({
          slug,
          name: top.targetName,
          websiteUrl: top.targetUrl,
          monthlyPriceUsd: top.monthlyPriceUsd,
          description: top.pitch,
        })
        .returning();
      await ensureTargetIcon(created.id, slug, created.websiteUrl);
      targetId = created.id;
    }
  }

  const [contest] = await db
    .insert(contests)
    .values({
      slug: await uniqueContestSlug(top.targetName),
      title: `${top.targetName} alternative`,
      targetId,
      brief: top.pitch,
      requirements: [],
      status: "queued",
    })
    .returning();

  await attachNominationToContest(contest.id, top.id);

  return contest;
}

export async function uniqueContestSlug(name: string) {
  const base = slugify(name) || "contest";
  const week = new Date().toISOString().slice(0, 10);
  let slug = `${base}-${week}`;
  let n = 2;
  while (
    (await db.select({ id: contests.id }).from(contests).where(eq(contests.slug, slug)).limit(1))
      .length
  ) {
    slug = `${base}-${week}-${n++}`;
  }
  return slug;
}

/** Current pipeline state — this is what the homepage renders. */
export async function getWeeklyState() {
  // Joined rather than selected bare: every surface that names a contest also
  // shows the product it replaces, icon included
  const withTarget = () =>
    db
      .select({
        id: contests.id,
        slug: contests.slug,
        title: contests.title,
        brief: contests.brief,
        requirements: contests.requirements,
        status: contests.status,
        buildingStartsAt: contests.buildingStartsAt,
        votingStartsAt: contests.votingStartsAt,
        endsAt: contests.endsAt,
        winnerProjectId: contests.winnerProjectId,
        targetName: targets.name,
        targetLogo: targets.logoUrl,
        targetSlug: targets.slug,
        targetPrice: targets.monthlyPriceUsd,
      })
      .from(contests)
      .leftJoin(targets, eq(targets.id, contests.targetId));

  const [building] = await withTarget().where(eq(contests.status, "building")).limit(1);
  const [voting] = await withTarget().where(eq(contests.status, "voting")).limit(1);
  const [finished] = await withTarget().where(eq(contests.status, "finished")).limit(1);
  const queued = await db
    .select()
    .from(contests)
    .where(eq(contests.status, "queued"))
    .orderBy(asc(contests.queuePosition), asc(contests.id));

  return { building, voting, finished, queued };
}

/** Whether entries can be submitted to this contest right now. */
export function canSubmitEntry(status: string) {
  return status === "building";
}

/** Whether voting is open right now. */
export function canVote(status: string) {
  return status === "voting";
}
