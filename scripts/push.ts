/**
 * Applies the SQL migrations in ./drizzle to the current database.
 *
 * A hand-rolled runner instead of `drizzle-kit migrate` for one reason:
 * drizzle-kit reaches the database over a URL, while PGlite is an embedded
 * file-backed engine nothing can connect to from outside. This runner handles
 * both because it reuses the exact connection the app uses.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { sql } from "drizzle-orm";

import { assertDatabaseFree } from "./guard";

config({ path: ".env.local" });

async function main() {
  await assertDatabaseFree("db:push");
  const { db, usingPglite } = await import("../src/lib/db");

  const dir = join(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Database: ${usingPglite ? "PGlite (.data/pg)" : "Postgres via DATABASE_URL"}`);
  console.log(`Migrations found: ${files.length}`);

  await db.execute(
    sql`create table if not exists __migrations (name text primary key, applied_at timestamptz default now())`,
  );

  const applied = await db.execute(sql`select name from __migrations`);
  const done = new Set(
    (applied as unknown as { rows?: { name: string }[] }).rows?.map((r) => r.name) ??
      (applied as unknown as { name: string }[]).map((r) => r.name),
  );

  for (const file of files) {
    if (done.has(file)) {
      console.log(`  ✓ ${file} (already applied)`);
      continue;
    }

    const content = readFileSync(join(dir, file), "utf8");
    // drizzle-kit separates statements with this marker
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await db.execute(sql.raw(statement));
    }

    await db.execute(sql`insert into __migrations (name) values (${file})`);
    console.log(`  → ${file} applied (${statements.length} statements)`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
