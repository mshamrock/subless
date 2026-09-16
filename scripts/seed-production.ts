/**
 * Seeds reference data into whatever database DATABASE_URL points at.
 *
 *   npm run db:seed:prod                     services + catalogued alternatives
 *   npm run db:seed:prod -- --targets-only   services only, empty catalog
 *
 * The second form is closer to brand brief §19, which argues for opening with
 * one question rather than a furnished directory. Use it if the catalog should
 * be filled entirely by what the challenges produce.
 *
 * The same logic is available to admins as a button, so nobody has to hold a
 * production connection string to run it.
 */
import { config } from "dotenv";

import { assertDatabaseFree } from "./guard";

config({ path: ".env.local" });

async function main() {
  await assertDatabaseFree("db:seed:prod", "Seed reference data");
  const { seedReferenceData } = await import("../src/lib/seed-data");

  const r = await seedReferenceData({
    targetsOnly: process.argv.includes("--targets-only"),
    onProgress: (line) => console.log(`  + ${line}`),
  });

  console.log(
    `\nCategories ${r.categories} · services ${r.services} · alternatives ${r.alternatives}` +
      (r.skipped ? ` · already present ${r.skipped}` : ""),
  );
  console.log("No users, votes, comments or recorded switches were created.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Seeding failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
