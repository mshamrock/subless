import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contestEntries, contests, nominations, nominationVotes, targets } from "@/lib/db/schema";
import { runWeeklyTick, tallyContest, getWeeklyState } from "@/lib/cycle";
import {
  makeContest, makeEntry, makeProject, makeTarget, makeUser, migrate, reset, vote,
} from "./helpers";

/**
 * The weekly tick is the riskiest code in the project: it runs unattended on a
 * cron, mutates state irreversibly, and a mistake costs the community a week of
 * work in public. These tests exist because clicking through it once is not
 * evidence that it still works next month.
 */
beforeAll(async () => {
  await migrate();
});

beforeEach(async () => {
  await reset();
});

async function statuses() {
  const rows = await db.select({ title: contests.title, status: contests.status }).from(contests);
  return Object.fromEntries(rows.map((r) => [r.title, r.status]));
}

describe("runWeeklyTick", () => {
  it("advances every phase exactly one step", async () => {
    await makeContest("Finished", "finished");
    await makeContest("Voting", "voting");
    await makeContest("Building", "building");
    await makeContest("Queued", "queued", { queuePosition: 1 });

    await runWeeklyTick("cron");

    expect(await statuses()).toEqual({
      Finished: "archived",
      Voting: "finished",
      Building: "voting",
      Queued: "building",
    });
  });

  it("does not let a queued challenge skip the voting phase in one tick", async () => {
    // The ordering bug this guards against: moving `building` before `queued`
    // would promote the new challenge twice in a single run
    await makeContest("Building", "building");
    await makeContest("Queued", "queued", { queuePosition: 1 });

    await runWeeklyTick("cron");

    const s = await statuses();
    expect(s.Queued).toBe("building");
    expect(s.Building).toBe("voting");
  });

  it("records the winner from the vote count", async () => {
    const [anna, pavel, lena, oleg] = await Promise.all(
      ["anna", "pavel", "lena", "oleg"].map(makeUser),
    );
    const contest = await makeContest("Voting", "voting");
    const winner = await makeProject("Winner", anna);
    const loser = await makeProject("Loser", pavel);

    const winnerEntry = await makeEntry(contest.id, winner.id, anna);
    const loserEntry = await makeEntry(contest.id, loser.id, pavel);

    await vote(contest.id, winnerEntry.id, lena);
    await vote(contest.id, loserEntry.id, oleg);

    await runWeeklyTick("cron");

    const [row] = await db.select().from(contests).where(eq(contests.id, contest.id));
    expect(row.status).toBe("finished");
    expect(row.winnerProjectId).toBe(winner.id);

    // Final counts are snapshotted so published results cannot drift afterwards
    const entries = await db
      .select()
      .from(contestEntries)
      .where(eq(contestEntries.contestId, contest.id));
    const byProject = Object.fromEntries(entries.map((e) => [e.projectId, e]));
    expect(byProject[winner.id].finalVotes).toBe(1);
    expect(byProject[winner.id].rank).toBe(1);
    expect(byProject[loser.id].rank).toBe(2);
  });

  it("finishes a challenge that received no entries without a winner", async () => {
    const contest = await makeContest("Empty", "voting");

    await runWeeklyTick("cron");

    const [row] = await db.select().from(contests).where(eq(contests.id, contest.id));
    expect(row.status).toBe("finished");
    expect(row.winnerProjectId).toBeNull();
  });

  it("starts nothing when the queue is empty and no nomination is approved", async () => {
    await makeContest("Building", "building");

    const result = await runWeeklyTick("cron");

    expect((await statuses()).Building).toBe("voting");
    expect(result.events.join(" ")).toContain("No contests queued");
  });

  it("promotes the most-voted approved nomination when the queue runs dry", async () => {
    const [anna, pavel, lena] = await Promise.all(["anna", "pavel", "lena"].map(makeUser));

    const [weak] = await db
      .insert(nominations)
      .values({ targetName: "Weak", pitch: "meh", status: "approved", submittedById: anna })
      .returning();
    const [strong] = await db
      .insert(nominations)
      .values({ targetName: "Strong", pitch: "yes", status: "approved", submittedById: anna })
      .returning();

    await db.insert(nominationVotes).values({ nominationId: weak.id, userId: anna });
    await db.insert(nominationVotes).values([
      { nominationId: strong.id, userId: anna },
      { nominationId: strong.id, userId: pavel },
      { nominationId: strong.id, userId: lena },
    ]);

    await runWeeklyTick("cron");

    const state = await getWeeklyState();
    expect(state.building?.title).toBe("Strong alternative");

    // Promotion registers the service in the catalog and marks the nomination used
    const [createdTarget] = await db.select().from(targets).where(eq(targets.slug, "strong"));
    expect(createdTarget).toBeDefined();

    const [used] = await db.select().from(nominations).where(eq(nominations.id, strong.id));
    expect(used.status).toBe("promoted");

    // Both ends of the link, so /wanted can point at the contest it became
    const [contest] = await db
      .select()
      .from(contests)
      .where(eq(contests.id, used.promotedContestId!));
    expect(contest.originNominationId).toBe(strong.id);
  });

  it("leaves a losing nomination open for the next round", async () => {
    const anna = await makeUser("anna");
    const [weak] = await db
      .insert(nominations)
      .values({ targetName: "Weak", pitch: "meh", status: "approved", submittedById: anna })
      .returning();
    const [strong] = await db
      .insert(nominations)
      .values({ targetName: "Strong", pitch: "yes", status: "approved", submittedById: anna })
      .returning();
    await db.insert(nominationVotes).values({ nominationId: strong.id, userId: anna });

    await runWeeklyTick("cron");

    const [loser] = await db.select().from(nominations).where(eq(nominations.id, weak.id));
    expect(loser.status).toBe("approved");
    expect(loser.promotedContestId).toBeNull();
  });

  it("writes every run to the cycle log", async () => {
    await makeContest("Building", "building");
    const result = await runWeeklyTick("admin");
    expect(result.events.length).toBeGreaterThan(0);
  });
});

describe("tallyContest", () => {
  it("breaks ties in favour of the earlier submission", async () => {
    const [anna, pavel, lena, oleg] = await Promise.all(
      ["anna", "pavel", "lena", "oleg"].map(makeUser),
    );
    const contest = await makeContest("Tie", "voting");
    const first = await makeProject("First", anna);
    const second = await makeProject("Second", pavel);

    const firstEntry = await makeEntry(contest.id, first.id, anna);
    // A later createdAt, set explicitly so the test does not race the clock
    const secondEntry = await makeEntry(contest.id, second.id, pavel);
    await db
      .update(contestEntries)
      .set({ createdAt: new Date(Date.now() + 60_000) })
      .where(eq(contestEntries.id, secondEntry.id));

    await vote(contest.id, firstEntry.id, lena);
    await vote(contest.id, secondEntry.id, oleg);

    const tally = await tallyContest(contest.id);
    expect(tally[0].projectId).toBe(first.id);
    expect(tally[0].votes).toBe(tally[1].votes);
  });

  it("counts an entry with no votes as zero rather than dropping it", async () => {
    const anna = await makeUser("anna");
    const contest = await makeContest("Quiet", "voting");
    const project = await makeProject("Quiet build", anna);
    await makeEntry(contest.id, project.id, anna);

    const tally = await tallyContest(contest.id);
    expect(tally).toHaveLength(1);
    expect(tally[0].votes).toBe(0);
  });
});
