import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { switches, targets } from "@/lib/db/schema";
import { getSiteStats, getUserSwitches } from "@/lib/queries";
import { makeTarget, makeUser, migrate, reset } from "./helpers";

/**
 * The switch table feeds the North Star, so the arithmetic behind the site's
 * single most visible number gets its own coverage.
 */
beforeAll(async () => {
  await migrate();
});
beforeEach(async () => {
  await reset();
});

describe("recorded switches", () => {
  it("sums annual savings across people into the North Star", async () => {
    const [anna, pavel] = await Promise.all(["anna", "pavel"].map(makeUser));
    const calendly = await makeTarget("Calendly", 12);
    const miro = await makeTarget("Miro", 16);

    await db.insert(switches).values([
      { userId: anna, targetId: calendly.id, annualUsd: 144 },
      { userId: anna, targetId: miro.id, annualUsd: 192 },
      { userId: pavel, targetId: calendly.id, annualUsd: 144 },
    ]);

    const stats = await getSiteStats();
    expect(stats.annualReplacedUsd).toBe(480);
    expect(stats.switchCount).toBe(3);
    expect(stats.switchers).toBe(2);
  });

  it("keeps the price recorded at switch time when the target is repriced later", async () => {
    // Someone's saving is a historical fact; a vendor raising its plan must not
    // silently rewrite what they saved last year
    const anna = await makeUser("anna");
    const target = await makeTarget("Notion", 10);
    await db.insert(switches).values({ userId: anna, targetId: target.id, annualUsd: 120 });

    await db.update(targets).set({ monthlyPriceUsd: 30 }).where(eq(targets.id, target.id));

    const [row] = await getUserSwitches(anna);
    expect(row.annualUsd).toBe(120);
    expect((await getSiteStats()).annualReplacedUsd).toBe(120);
  });

  it("counts one person leaving one subscription only once", async () => {
    const anna = await makeUser("anna");
    const target = await makeTarget("Figma", 15);

    await db.insert(switches).values({ userId: anna, targetId: target.id, annualUsd: 180 });
    await db
      .insert(switches)
      .values({ userId: anna, targetId: target.id, annualUsd: 180 })
      .onConflictDoNothing();

    expect((await getSiteStats()).switchCount).toBe(1);
  });
});
