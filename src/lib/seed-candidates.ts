import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, nominations, targets } from "@/lib/db/schema";
import { CANDIDATES, CANDIDATE_CATEGORIES } from "@/lib/data/candidates";
import { ensureTargetIcon } from "@/lib/targets";
import { slugify } from "@/lib/utils";

export interface CandidateSeedResult {
  categories: number;
  services: number;
  nominations: number;
  skipped: number;
  icons: number;
  categorised: number;
}

/**
 * Loads the starting slate of nomination candidates.
 *
 * Every nomination lands with **zero votes and no author**, which is the whole
 * point: a seeded candidate says "here is something to consider", while a
 * seeded vote count would be fabricated demand. Demand is the one thing this
 * site cannot invent without undermining its own headline number.
 *
 * Idempotent — a service already in the catalog is linked rather than
 * duplicated, and a nomination that already exists is left alone, votes and all.
 */
export async function seedCandidates(
  onProgress?: (line: string) => void,
): Promise<CandidateSeedResult> {
  const log = onProgress ?? (() => {});
  const result: CandidateSeedResult = {
    categories: 0,
    services: 0,
    nominations: 0,
    skipped: 0,
    icons: 0,
    categorised: 0,
  };

  const categoryIds = new Map<string, number>();
  for (const c of CANDIDATE_CATEGORIES) {
    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, c.slug))
      .limit(1);
    if (existing) {
      categoryIds.set(c.slug, existing.id);
      continue;
    }
    const [row] = await db.insert(categories).values(c).returning();
    categoryIds.set(c.slug, row.id);
    result.categories++;
  }

  for (const candidate of CANDIDATES) {
    const slug = slugify(candidate.name);

    let [target] = await db.select().from(targets).where(eq(targets.slug, slug)).limit(1);
    if (!target) {
      [target] = await db
        .insert(targets)
        .values({
          slug,
          name: candidate.name,
          websiteUrl: candidate.url,
          monthlyPriceUsd: candidate.price,
          description: candidate.pitch,
          categoryId: categoryIds.get(candidate.category) ?? null,
        })
        .returning();
      result.services++;
    }

    // Backfill a category onto a service that predates this list. Without this
    // the row is invisible under every category filter while still counting
    // towards the total, which reads as a broken filter.
    const categoryId = categoryIds.get(candidate.category) ?? null;
    if (categoryId && !target.categoryId) {
      await db.update(targets).set({ categoryId }).where(eq(targets.id, target.id));
      result.categorised++;
    }

    if (!target.logoData) {
      if (await ensureTargetIcon(target.id, target.slug, target.websiteUrl)) result.icons++;
    }

    const [existingNomination] = await db
      .select()
      .from(nominations)
      .where(and(eq(nominations.targetId, target.id)))
      .limit(1);

    if (existingNomination) {
      result.skipped++;
      continue;
    }

    await db.insert(nominations).values({
      targetId: target.id,
      targetName: candidate.name,
      targetUrl: candidate.url,
      pitch: candidate.pitch,
      monthlyPriceUsd: candidate.price,
      // No author and no votes. Seeded candidates are a starting slate, not demand.
      submittedById: null,
      status: "approved",
    });
    result.nominations++;
    log(candidate.name);
  }

  return result;
}
