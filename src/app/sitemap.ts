import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contests, projects, targets, users } from "@/lib/db/schema";
import { BRAND } from "@/lib/brand";
import { getIndexableTargetSlugs } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * People searching "calendly alternative" are the point of the site's organic
 * reach, so every /alternatives page is listed — including services with no
 * build yet, because those pages collect demand rather than traffic.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A sitemap is a claim that these pages are worth indexing, so it must not
  // contradict the noindex the empty ones carry
  const indexable = await getIndexableTargetSlugs();

  const [targetRows, projectRows, challengeRows, builderRows] = await Promise.all([
    db.select({ slug: targets.slug }).from(targets),
    db
      .select({ slug: projects.slug, updatedAt: projects.approvedAt })
      .from(projects)
      .where(eq(projects.status, "approved")),
    db.select({ slug: contests.slug, updatedAt: contests.createdAt }).from(contests),
    db
      .selectDistinct({ login: users.githubLogin })
      .from(users)
      .innerJoin(
        projects,
        and(eq(projects.submittedById, users.id), eq(projects.status, "approved")),
      ),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: BRAND.url, changeFrequency: "daily", priority: 1 },
    { url: `${BRAND.url}/wanted`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BRAND.url}/challenges`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BRAND.url}/alternatives`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BRAND.url}/catalog`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BRAND.url}/leaderboard`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BRAND.url}/how-it-works`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BRAND.url}/submit`, changeFrequency: "weekly", priority: 0.5 },
  ];

  return [
    ...staticPages,
    ...targetRows
      .filter((t) => indexable.has(t.slug))
      .map((t) => ({
        url: `${BRAND.url}/alternatives/${t.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.9,
      })),
    ...projectRows.map((p) => ({
      url: `${BRAND.url}/projects/${p.slug}`,
      lastModified: p.updatedAt ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...builderRows
      .filter((b) => b.login)
      .map((b) => ({
        url: `${BRAND.url}/builders/${b.login}`,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      })),
    ...challengeRows.map((c) => ({
      url: `${BRAND.url}/challenges/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
