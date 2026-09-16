import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { nominations, targets } from "@/lib/db/schema";
import { fetchProductIcon, iconUrl } from "@/lib/logos";
import { slugify } from "@/lib/utils";

/**
 * Fetches and stores a product icon for a target.
 *
 * Deliberately never throws: an icon is decoration, and a slow or unreachable
 * favicon host must not be able to fail a project submission behind it.
 */
export async function ensureTargetIcon(
  targetId: number,
  slug: string,
  websiteUrl: string | null,
): Promise<boolean> {
  if (!websiteUrl) return false;

  try {
    const icon = await fetchProductIcon(websiteUrl);
    if (!icon) return false;

    await db
      .update(targets)
      .set({
        logoData: icon.data,
        logoContentType: icon.contentType,
        logoUrl: iconUrl(slug),
      })
      .where(eq(targets.id, targetId));

    return true;
  } catch {
    return false;
  }
}

/**
 * Finds or creates the catalog row for a paid service, fetching its icon on
 * first sight. Used wherever a service is named outside the catalog — a promoted
 * nomination, a contest with a brand-new target, a project submission.
 *
 * A target with no alternatives yet is harmless: the catalog only lists services
 * that have at least one, while the submission picker lists them all, so someone
 * building the first alternative to a nominated service can attach it properly.
 */
export async function ensureTarget(input: {
  name: string;
  websiteUrl?: string | null;
  monthlyPriceUsd?: number | null;
  description?: string | null;
}): Promise<number> {
  const slug = slugify(input.name);

  const [existing] = await db.select().from(targets).where(eq(targets.slug, slug)).limit(1);
  if (existing) {
    // Backfill an icon for a row created before we had one
    if (!existing.logoData) {
      await ensureTargetIcon(existing.id, existing.slug, existing.websiteUrl ?? input.websiteUrl ?? null);
    }
    return existing.id;
  }

  const [created] = await db
    .insert(targets)
    .values({
      slug,
      name: input.name.trim(),
      websiteUrl: input.websiteUrl ?? null,
      monthlyPriceUsd: input.monthlyPriceUsd ?? null,
      description: input.description ?? null,
    })
    .returning();

  await ensureTargetIcon(created.id, slug, created.websiteUrl);
  return created.id;
}

export interface IconBackfillResult {
  scanned: number;
  stored: number;
  failed: string[];
  nominationsLinked: number;
}

/**
 * Fills in whatever is missing: icons for targets that have none, and catalog
 * rows for approved nominations predating the rule that approval registers the
 * service. Shared by `npm run db:logos` and the admin button so the two cannot
 * drift apart — PGlite only allows one process, so the button is the only route
 * available while the server is running.
 */
export async function backfillTargetIcons(force = false): Promise<IconBackfillResult> {
  const rows = force
    ? await db.select().from(targets)
    : await db.select().from(targets).where(isNull(targets.logoData));

  const result: IconBackfillResult = {
    scanned: rows.length,
    stored: 0,
    failed: [],
    nominationsLinked: 0,
  };

  for (const target of rows) {
    const ok = await ensureTargetIcon(target.id, target.slug, target.websiteUrl);
    if (ok) result.stored++;
    else result.failed.push(target.name);
  }

  const orphaned = await db
    .select()
    .from(nominations)
    .where(and(eq(nominations.status, "approved"), isNull(nominations.targetId)));

  for (const n of orphaned) {
    const targetId = await ensureTarget({
      name: n.targetName,
      websiteUrl: n.targetUrl,
      monthlyPriceUsd: n.monthlyPriceUsd,
      description: n.pitch,
    });
    await db.update(nominations).set({ targetId }).where(eq(nominations.id, n.id));
    result.nominationsLinked++;
  }

  return result;
}
