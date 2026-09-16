/** Quick health check: how many projects carry real GitHub metrics. */
import { config } from "dotenv";
import { assertDatabaseFree } from "./guard";

config({ path: ".env.local" });

async function main() {
  await assertDatabaseFree("db:stats");
  const { db } = await import("../src/lib/db");
  const s = await import("../src/lib/db/schema");
  const { eq, desc } = await import("drizzle-orm");

  const rows = await db
    .select({
      name: s.projects.name,
      stars: s.projectMetrics.stars,
      score: s.projectMetrics.score,
      err: s.projectMetrics.syncError,
    })
    .from(s.projects)
    .leftJoin(s.projectMetrics, eq(s.projectMetrics.projectId, s.projects.id))
    .orderBy(desc(s.projectMetrics.score));

  const synced = rows.filter((r) => (r.stars ?? 0) > 0);
  console.log(`Projects with live metrics: ${synced.length}/${rows.length}`);
  for (const r of rows.slice(0, 8)) {
    console.log(`  ${r.name.padEnd(14)} ★${r.stars ?? 0}\tscore ${r.score ?? 0}${r.err ? "\t[" + r.err + "]" : ""}`);
  }

  // Real accounts only: demo-* users are seed fixtures, not sign-ins
  const people = await db
    .select({
      login: s.users.githubLogin,
      isAdmin: s.users.isAdmin,
      githubCreatedAt: s.users.githubCreatedAt,
    })
    .from(s.users);

  const real = people.filter((u) => !u.login?.startsWith("demo-"));
  console.log(`\nSigned-in accounts: ${real.length}`);
  for (const u of real) {
    const ageDays = u.githubCreatedAt
      ? Math.floor((Date.now() - u.githubCreatedAt.getTime()) / 86_400_000)
      : null;
    console.log(
      `  @${u.login}  admin: ${u.isAdmin ? "yes" : "NO"}  ` +
        `account age: ${ageDays === null ? "unknown" : ageDays + "d"}` +
        (ageDays !== null && ageDays < 30 ? "  (too new to vote)" : ""),
    );
  }

  const pending = await db
    .select({
      name: s.projects.name,
      slug: s.projects.slug,
      repo: s.projects.repoFullName,
      verified: s.projects.ownershipVerified,
      status: s.projects.status,
      builtWith: s.projects.builtWith,
      home: s.projects.homepageUrl,
    })
    .from(s.projects)
    .where(eq(s.projects.status, "pending"));

  console.log(`\nAwaiting moderation: ${pending.length}`);
  for (const p of pending) {
    console.log(
      `  ${p.name} (${p.repo})  ownership: ${p.verified ? "verified" : "unverified"}` +
        `  built with: ${p.builtWith ?? "—"}  demo: ${p.home ?? "—"}`,
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
