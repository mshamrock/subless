/** Fetches and stores product icons for every target that does not have one. */
import { config } from "dotenv";

import { assertDatabaseFree } from "./guard";

config({ path: ".env.local" });

async function main() {
  await assertDatabaseFree("db:logos", "Fetch missing icons");
  const { backfillTargetIcons } = await import("../src/lib/targets");

  const force = process.argv.includes("--force");
  const r = await backfillTargetIcons(force);

  console.log(`Icons stored: ${r.stored} of ${r.scanned}${force ? " (forced refresh)" : ""}`);
  for (const name of r.failed) console.log(`  · ${name} — no usable icon`);
  if (r.nominationsLinked) {
    console.log(`Approved nominations registered in the catalog: ${r.nominationsLinked}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Icon backfill failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
