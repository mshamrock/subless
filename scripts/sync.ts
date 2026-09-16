/** Manually sync GitHub metrics for every approved project. */
import { config } from "dotenv";

import { assertDatabaseFree } from "./guard";

config({ path: ".env.local" });

async function main() {
  await assertDatabaseFree("db:sync", "Sync metrics");
  const { syncAllProjects } = await import("../src/lib/sync");

  if (!process.env.GITHUB_TOKEN) {
    console.warn(
      "GITHUB_TOKEN is not set — the limit is 60 requests/hour, and each project costs three.\n",
    );
  }

  const result = await syncAllProjects();
  console.log(`Synced ${result.ok} of ${result.total}, failed: ${result.failed}`);
  for (const err of result.errors) console.log("  ! " + err);
  process.exit(result.failed === result.total && result.total > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
