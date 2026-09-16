import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/**
 * Applies the real migrations to the in-memory database.
 *
 * Deliberately the same SQL production runs rather than a hand-written test
 * schema: a test schema that has drifted from the migrations tests nothing.
 */
export async function migrate() {
  const dir = join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const content = readFileSync(join(dir, file), "utf8");
    for (const statement of content.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await db.execute(sql.raw(trimmed));
    }
  }
}

/** Wipes every table between tests, leaving the schema in place. */
export async function reset() {
  for (const table of [
    schema.switches, schema.notifications, schema.comments,
    schema.contestVotes, schema.contestEntries,
    schema.nominationVotes, schema.nominations,
    schema.contests, schema.projectUpvotes, schema.githubStats,
    schema.projectMetrics, schema.projectTargets, schema.projects,
    schema.targets, schema.categories, schema.cycleLog, schema.users,
  ]) {
    await db.delete(table);
  }
}

let seq = 0;
const uid = () => `u${++seq}`;

export async function makeUser(login: string) {
  const id = uid();
  await db.insert(schema.users).values({ id, githubLogin: login, name: login });
  return id;
}

export async function makeTarget(name: string, monthly = 10) {
  const [row] = await db
    .insert(schema.targets)
    .values({ slug: name.toLowerCase(), name, monthlyPriceUsd: monthly })
    .returning();
  return row;
}

export async function makeProject(name: string, ownerId: string) {
  const [row] = await db
    .insert(schema.projects)
    .values({
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      tagline: `${name} does a thing`,
      repoUrl: `https://github.com/test/${name.toLowerCase()}`,
      repoFullName: `test/${name.toLowerCase()}`,
      submittedById: ownerId,
      status: "approved",
    })
    .returning();
  return row;
}

export async function makeContest(
  title: string,
  status: string,
  extra: Partial<typeof schema.contests.$inferInsert> = {},
) {
  const [row] = await db
    .insert(schema.contests)
    .values({
      slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${++seq}`,
      title,
      brief: `Build a ${title}`,
      status,
      ...extra,
    })
    .returning();
  return row;
}

export async function makeEntry(contestId: number, projectId: number, userId: string) {
  const [row] = await db
    .insert(schema.contestEntries)
    .values({ contestId, projectId, userId })
    .returning();
  return row;
}

export async function vote(contestId: number, entryId: number, userId: string) {
  await db.insert(schema.contestVotes).values({ contestId, entryId, userId });
}
