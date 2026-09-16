/**
 * Loads the nomination candidate slate.
 *
 *   npm run db:seed:candidates
 *
 * Also available to admins as a button, so nobody needs a production
 * connection string to run it.
 */
import { config } from "dotenv";

import { assertDatabaseFree } from "./guard";

config({ path: ".env.local" });

async function main() {
  await assertDatabaseFree("db:seed:candidates", "Load nomination candidates");
  const { seedCandidates } = await import("../src/lib/seed-candidates");

  const r = await seedCandidates((name) => console.log(`  + ${name}`));

  console.log(
    `\nCategories ${r.categories} · services ${r.services} · nominations ${r.nominations}` +
      ` · icons ${r.icons}` +
      (r.skipped ? ` · already nominated ${r.skipped}` : ""),
  );
  console.log("Every nomination was created with zero votes and no author.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Seeding failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
