import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  categories,
  comments,
  notifications,
  contestEntries,
  contestVotes,
  contests,
  githubDetails,
  nominationVotes,
  nominations,
  projectMetrics,
  projectTargets,
  projectUpvotes,
  projects,
  switches,
  testReports,
  targets,
  users,
} from "@/lib/db/schema";

/* ────────────────────────────────  Catalog  ──────────────────────────────── */

export type CatalogSort = "score" | "stars" | "new" | "alpha";

export interface CatalogFilters {
  q?: string;
  category?: string;
  target?: string;
  sort?: CatalogSort;
  limit?: number;
}

const projectCard = {
  id: projects.id,
  slug: projects.slug,
  name: projects.name,
  tagline: projects.tagline,
  repoUrl: projects.repoUrl,
  repoFullName: projects.repoFullName,
  homepageUrl: projects.homepageUrl,
  builtWith: projects.builtWith,
  licenseSpdx: projects.licenseSpdx,
  ownershipVerified: projects.ownershipVerified,
  createdAt: projects.createdAt,
  authorLogin: users.githubLogin,
  authorImage: users.image,
  stars: sql<number>`coalesce(${projectMetrics.stars}, 0)::int`,
  forks: sql<number>`coalesce(${projectMetrics.forks}, 0)::int`,
  contributors: sql<number>`coalesce(${projectMetrics.contributors}, 0)::int`,
  downloads: sql<number>`coalesce(${projectMetrics.releaseDownloads}, 0)::int`,
  upvotes: sql<number>`coalesce(${projectMetrics.upvotes}, 0)::int`,
  starsDelta7d: sql<number>`coalesce(${projectMetrics.starsDelta7d}, 0)::int`,
  score: sql<number>`coalesce(${projectMetrics.score}, 0)::real`,
  pushedAt: projectMetrics.pushedAt,
};

export type ProjectCard = Awaited<ReturnType<typeof getCatalog>>[number];

export async function getCatalog(filters: CatalogFilters = {}) {
  const { q, category, target, sort = "score", limit = 120 } = filters;

  const where = [eq(projects.status, "approved")];

  if (q?.trim()) {
    const needle = `%${q.trim()}%`;
    // Search both the alternative and the service it replaces: people arrive
    // typing "Gyazo", not the name of some project they have never heard of
    const matchingTargetIds = db
      .select({ projectId: projectTargets.projectId })
      .from(projectTargets)
      .innerJoin(targets, eq(targets.id, projectTargets.targetId))
      .where(ilike(targets.name, needle));

    where.push(
      or(
        ilike(projects.name, needle),
        ilike(projects.tagline, needle),
        ilike(projects.description, needle),
        inArray(projects.id, matchingTargetIds),
      )!,
    );
  }

  if (target) {
    const ids = db
      .select({ projectId: projectTargets.projectId })
      .from(projectTargets)
      .innerJoin(targets, eq(targets.id, projectTargets.targetId))
      .where(eq(targets.slug, target));
    where.push(inArray(projects.id, ids));
  }

  if (category) {
    const ids = db
      .select({ projectId: projectTargets.projectId })
      .from(projectTargets)
      .innerJoin(targets, eq(targets.id, projectTargets.targetId))
      .innerJoin(categories, eq(categories.id, targets.categoryId))
      .where(eq(categories.slug, category));
    where.push(inArray(projects.id, ids));
  }

  const orderBy = {
    score: desc(sql`coalesce(${projectMetrics.score}, 0)`),
    stars: desc(sql`coalesce(${projectMetrics.stars}, 0)`),
    new: desc(projects.createdAt),
    alpha: asc(projects.name),
  }[sort];

  const rows = await db
    .select(projectCard)
    .from(projects)
    .leftJoin(projectMetrics, eq(projectMetrics.projectId, projects.id))
    .leftJoin(users, eq(users.id, projects.submittedById))
    .where(and(...where))
    .orderBy(orderBy)
    .limit(limit);

  return attachTargets(rows);
}

/** Load the "alternative to what" links in one query instead of N+1. */
async function attachTargets<T extends { id: number }>(rows: T[]) {
  if (rows.length === 0) return rows.map((r) => ({ ...r, targets: [] as TargetChip[] }));

  const links = await db
    .select({
      projectId: projectTargets.projectId,
      id: targets.id,
      slug: targets.slug,
      name: targets.name,
      logoUrl: targets.logoUrl,
      monthlyPriceUsd: targets.monthlyPriceUsd,
    })
    .from(projectTargets)
    .innerJoin(targets, eq(targets.id, projectTargets.targetId))
    .where(inArray(projectTargets.projectId, rows.map((r) => r.id)));

  const byProject = new Map<number, TargetChip[]>();
  for (const l of links) {
    const list = byProject.get(l.projectId) ?? [];
    list.push({
      id: l.id,
      slug: l.slug,
      name: l.name,
      logoUrl: l.logoUrl,
      monthlyPriceUsd: l.monthlyPriceUsd,
    });
    byProject.set(l.projectId, list);
  }

  return rows.map((r) => ({ ...r, targets: byProject.get(r.id) ?? [] }));
}

export interface TargetChip {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  monthlyPriceUsd: number | null;
}

export async function getProjectBySlug(slug: string) {
  const [row] = await db
    .select({
      ...projectCard,
      description: projects.description,
      status: projects.status,
      isSelfHosted: projects.isSelfHosted,
      submittedById: projects.submittedById,
      authorName: users.name,
      syncedAt: projectMetrics.syncedAt,
      syncError: projectMetrics.syncError,
      clicks: sql<number>`coalesce(${projectMetrics.clicks}, 0)::int`,
    })
    .from(projects)
    .leftJoin(projectMetrics, eq(projectMetrics.projectId, projects.id))
    .leftJoin(users, eq(users.id, projects.submittedById))
    .where(eq(projects.slug, slug))
    .limit(1);

  if (!row) return null;
  const [withTargets] = await attachTargets([row]);

  const wins = await db
    .select({
      contestSlug: contests.slug,
      contestTitle: contests.title,
      endsAt: contests.endsAt,
    })
    .from(contests)
    .where(eq(contests.winnerProjectId, row.id));

  return { ...withTargets, wins };
}

/** Every project this user has upvoted — one query per page instead of N. */
export async function getUserUpvotes(userId: string) {
  const rows = await db
    .select({ projectId: projectUpvotes.projectId })
    .from(projectUpvotes)
    .where(eq(projectUpvotes.userId, userId));
  return new Set(rows.map((r) => r.projectId));
}

/**
 * Builder profile (§12): impact, not vanity activity. The headline number is the
 * annual subscription cost this person's published work can replace — the same
 * unit as the site's North Star, so one builder's contribution is legible
 * against the whole community's.
 */
export async function getAuthorSummary(userId: string) {
  const [projects_] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(projects)
    .where(and(eq(projects.submittedById, userId), eq(projects.status, "approved")));

  const [wins] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(contests)
    .innerJoin(projects, eq(projects.id, contests.winnerProjectId))
    .where(eq(projects.submittedById, userId));

  const [entries] = await db
    .select({ n: sql<number>`count(distinct ${contestEntries.contestId})::int` })
    .from(contestEntries)
    .where(eq(contestEntries.userId, userId));

  // Adoption: people who recorded a switch using one of this builder's alternatives.
  // This is the number that separates a build people use from a build people starred.
  const [adopted] = await db
    .select({
      people: sql<number>`count(distinct ${switches.userId})::int`,
      annual: sql<number>`coalesce(sum(${switches.annualUsd}), 0)::real`,
    })
    .from(switches)
    .innerJoin(
      projects,
      and(eq(projects.id, switches.projectId), eq(projects.submittedById, userId)),
    );

  // Distinct services, so two alternatives to the same product do not double-count
  const [replaced] = await db
    .select({ sum: sql<number>`coalesce(sum(distinct ${targets.monthlyPriceUsd}), 0)::real` })
    .from(targets)
    .innerJoin(projectTargets, eq(projectTargets.targetId, targets.id))
    .innerJoin(
      projects,
      and(
        eq(projects.id, projectTargets.projectId),
        eq(projects.submittedById, userId),
        eq(projects.status, "approved"),
      ),
    );

  return {
    projectCount: projects_?.n ?? 0,
    winCount: wins?.n ?? 0,
    challengeCount: entries?.n ?? 0,
    /** What their published work *could* replace, across the services it covers. */
    replacedAnnualUsd: Math.round((replaced?.sum ?? 0) * 12),
    /** What people actually cancelled through their builds. */
    adoptions: adopted?.people ?? 0,
    adoptedAnnualUsd: Math.round(adopted?.annual ?? 0),
  };
}

export async function hasUpvoted(projectId: number, userId: string) {
  const [row] = await db
    .select({ x: projectUpvotes.userId })
    .from(projectUpvotes)
    .where(and(eq(projectUpvotes.projectId, projectId), eq(projectUpvotes.userId, userId)))
    .limit(1);
  return Boolean(row);
}

/* ────────────────────────────────  Services and categories  ──────────────────────────────── */

export async function getTargetsWithCounts() {
  return db
    .select({
      id: targets.id,
      slug: targets.slug,
      name: targets.name,
      logoUrl: targets.logoUrl,
      websiteUrl: targets.websiteUrl,
      description: targets.description,
      monthlyPriceUsd: targets.monthlyPriceUsd,
      categoryName: categories.name,
      categorySlug: categories.slug,
      categoryEmoji: categories.emoji,
      alternatives: sql<number>`count(distinct ${projects.id})::int`,
    })
    .from(targets)
    .leftJoin(categories, eq(categories.id, targets.categoryId))
    .leftJoin(projectTargets, eq(projectTargets.targetId, targets.id))
    .leftJoin(
      projects,
      and(eq(projects.id, projectTargets.projectId), eq(projects.status, "approved")),
    )
    .groupBy(targets.id, categories.id)
    .orderBy(desc(sql`count(distinct ${projects.id})`), asc(targets.name));
}

export async function getTargetBySlug(slug: string) {
  const [row] = await db
    .select({
      id: targets.id,
      slug: targets.slug,
      name: targets.name,
      logoUrl: targets.logoUrl,
      websiteUrl: targets.websiteUrl,
      description: targets.description,
      monthlyPriceUsd: targets.monthlyPriceUsd,
      categoryName: categories.name,
      categorySlug: categories.slug,
      categoryEmoji: categories.emoji,
    })
    .from(targets)
    .leftJoin(categories, eq(categories.id, targets.categoryId))
    .where(eq(targets.slug, slug))
    .limit(1);
  if (!row) return null;

  // "What people actually need" comes from the challenge brief for this service,
  // which is the one place the community has already agreed on a feature list
  const [challenge] = await db
    .select({ requirements: contests.requirements })
    .from(contests)
    .where(eq(contests.targetId, row.id))
    .orderBy(desc(contests.createdAt))
    .limit(1);

  return { ...row, requirements: challenge?.requirements ?? [] };
}

/** How many people voted to have this service replaced, across all its nominations. */
export async function getTargetDemand(targetId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(${nominationVotes.userId})::int` })
    .from(nominations)
    .leftJoin(nominationVotes, eq(nominationVotes.nominationId, nominations.id))
    .where(eq(nominations.targetId, targetId));
  return row?.n ?? 0;
}

export async function getCategoriesWithCounts() {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      emoji: categories.emoji,
      targetCount: sql<number>`count(distinct ${targets.id})::int`,
    })
    .from(categories)
    .leftJoin(targets, eq(targets.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.name));
}

export async function getAllTargetsForPicker() {
  return db
    .select({ id: targets.id, name: targets.name, slug: targets.slug })
    .from(targets)
    .orderBy(asc(targets.name));
}

/* ────────────────────────────────  Contests  ──────────────────────────────── */

export async function getContestBySlug(slug: string) {
  const [contest] = await db
    .select({
      id: contests.id,
      slug: contests.slug,
      title: contests.title,
      brief: contests.brief,
      requirements: contests.requirements,
      status: contests.status,
      buildingStartsAt: contests.buildingStartsAt,
      votingStartsAt: contests.votingStartsAt,
      endsAt: contests.endsAt,
      winnerProjectId: contests.winnerProjectId,
      targetSlug: targets.slug,
      targetName: targets.name,
      targetLogo: targets.logoUrl,
      targetPrice: targets.monthlyPriceUsd,
      targetUrl: targets.websiteUrl,
    })
    .from(contests)
    .leftJoin(targets, eq(targets.id, contests.targetId))
    .where(eq(contests.slug, slug))
    .limit(1);
  return contest ?? null;
}

export async function getContestEntries(contestId: number) {
  const rows = await db
    .select({
      entryId: contestEntries.id,
      note: contestEntries.note,
      rank: contestEntries.rank,
      finalVotes: contestEntries.finalVotes,
      createdAt: contestEntries.createdAt,
      projectId: projects.id,
      slug: projects.slug,
      name: projects.name,
      tagline: projects.tagline,
      repoUrl: projects.repoUrl,
      homepageUrl: projects.homepageUrl,
      builtWith: projects.builtWith,
      authorLogin: users.githubLogin,
      authorName: users.name,
      authorImage: users.image,
      stars: sql<number>`coalesce(${projectMetrics.stars}, 0)::int`,
      votes: sql<number>`count(${contestVotes.userId})::int`,
    })
    .from(contestEntries)
    .innerJoin(projects, eq(projects.id, contestEntries.projectId))
    .leftJoin(users, eq(users.id, contestEntries.userId))
    .leftJoin(projectMetrics, eq(projectMetrics.projectId, projects.id))
    .leftJoin(contestVotes, eq(contestVotes.entryId, contestEntries.id))
    .where(eq(contestEntries.contestId, contestId))
    .groupBy(contestEntries.id, projects.id, users.id, projectMetrics.projectId)
    .orderBy(desc(sql`count(${contestVotes.userId})`), asc(contestEntries.createdAt));

  return rows;
}

export async function getUserVote(contestId: number, userId: string) {
  const [row] = await db
    .select({ entryId: contestVotes.entryId })
    .from(contestVotes)
    .where(and(eq(contestVotes.contestId, contestId), eq(contestVotes.userId, userId)))
    .limit(1);
  return row?.entryId ?? null;
}

export async function getContestList() {
  return db
    .select({
      id: contests.id,
      slug: contests.slug,
      title: contests.title,
      status: contests.status,
      brief: contests.brief,
      endsAt: contests.endsAt,
      buildingStartsAt: contests.buildingStartsAt,
      winnerProjectId: contests.winnerProjectId,
      targetName: targets.name,
      targetLogo: targets.logoUrl,
      entryCount: sql<number>`count(distinct ${contestEntries.id})::int`,
    })
    .from(contests)
    .leftJoin(targets, eq(targets.id, contests.targetId))
    .leftJoin(contestEntries, eq(contestEntries.contestId, contests.id))
    .groupBy(contests.id, targets.id)
    .orderBy(desc(contests.createdAt));
}

/** The user's own projects, eligible to be entered into a contest. */
export async function getUserProjects(userId: string) {
  return db
    .select({ id: projects.id, name: projects.name, slug: projects.slug, status: projects.status })
    .from(projects)
    .where(eq(projects.submittedById, userId))
    .orderBy(desc(projects.createdAt));
}

/* ────────────────────────────────  Nominations  ──────────────────────────────── */

export async function getNominations(
  status: "approved" | "pending" = "approved",
  q?: string,
  category?: string,
) {
  const needle = q?.trim() ? `%${q.trim()}%` : null;

  // Category lives on the service, not the nomination, so filtering means
  // restricting to nominations whose target sits in that category
  const inCategory = category?.trim()
    ? inArray(
        nominations.targetId,
        db
          .select({ id: targets.id })
          .from(targets)
          .innerJoin(categories, eq(categories.id, targets.categoryId))
          .where(eq(categories.slug, category)),
      )
    : null;

  return db
    .select({
      id: nominations.id,
      targetName: nominations.targetName,
      targetUrl: nominations.targetUrl,
      targetLogo: targets.logoUrl,
      pitch: nominations.pitch,
      monthlyPriceUsd: nominations.monthlyPriceUsd,
      status: nominations.status,
      createdAt: nominations.createdAt,
      authorLogin: users.githubLogin,
      authorName: users.name,
      authorImage: users.image,
      votes: sql<number>`count(${nominationVotes.userId})::int`,
    })
    .from(nominations)
    .leftJoin(users, eq(users.id, nominations.submittedById))
    .leftJoin(targets, eq(targets.id, nominations.targetId))
    .leftJoin(nominationVotes, eq(nominationVotes.nominationId, nominations.id))
    .where(
      and(
        eq(nominations.status, status),
        // Match the pitch too: people describe what they need before they
        // recall the product's exact name
        needle
          ? or(ilike(nominations.targetName, needle), ilike(nominations.pitch, needle))
          : undefined,
        inCategory ?? undefined,
      ),
    )
    .groupBy(nominations.id, users.id, targets.id)
    .orderBy(desc(sql`count(${nominationVotes.userId})`), desc(nominations.createdAt));
}

export async function getUserNominationVotes(userId: string) {
  const rows = await db
    .select({ nominationId: nominationVotes.nominationId })
    .from(nominationVotes)
    .where(eq(nominationVotes.userId, userId));
  return new Set(rows.map((r) => r.nominationId));
}

/* ────────────────────────────────  Homepage summary  ──────────────────────────────── */

/**
 * North Star (§13): annual subscription cost the community can replace.
 *
 * Counted as the yearly price of every paid service that has at least one
 * published alternative. It is deliberately labelled as what the catalog *can*
 * replace rather than what people have actually stopped paying — nothing here
 * tracks a real cancellation yet, and inflating the number would corrode the
 * one metric the whole brand is built on.
 */
export async function getSiteStats() {
  const [p] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(projects)
    .where(eq(projects.status, "approved"));
  const [t] = await db.select({ n: sql<number>`count(*)::int` }).from(targets);
  const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(contests);
  const [saved] = await db
    .select({ sum: sql<number>`coalesce(sum(distinct ${targets.monthlyPriceUsd}), 0)::real` })
    .from(targets)
    .innerJoin(projectTargets, eq(projectTargets.targetId, targets.id))
    .innerJoin(
      projects,
      and(eq(projects.id, projectTargets.projectId), eq(projects.status, "approved")),
    );

  const [nominated] = await db.select({ n: sql<number>`count(*)::int` }).from(nominations);
  const [votes] = await db.select({ n: sql<number>`count(*)::int` }).from(nominationVotes);
  const [builders] = await db
    .select({ n: sql<number>`count(distinct ${projects.submittedById})::int` })
    .from(projects)
    .where(eq(projects.status, "approved"));

  // The real North Star: money people actually stopped paying, from recorded switches
  const [replaced] = await db
    .select({
      sum: sql<number>`coalesce(sum(${switches.annualUsd}), 0)::real`,
      people: sql<number>`count(distinct ${switches.userId})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(switches);

  const monthly = saved?.sum ?? 0;

  return {
    projects: p?.n ?? 0,
    targets: t?.n ?? 0,
    challenges: c?.n ?? 0,
    nominated: nominated?.n ?? 0,
    votesCast: votes?.n ?? 0,
    builders: builders?.n ?? 0,
    /** Actually replaced, from recorded switches. */
    annualReplacedUsd: Math.round(replaced?.sum ?? 0),
    switchCount: replaced?.count ?? 0,
    switchers: replaced?.people ?? 0,
    /** Still on the table: what the published catalog could replace. */
    annualAvailableUsd: Math.round(monthly * 12),
  };
}

/* ────────────────────────────────  Going Subless  ──────────────────────────────── */

export async function getUserSwitches(userId: string) {
  return db
    .select({
      id: switches.id,
      annualUsd: switches.annualUsd,
      createdAt: switches.createdAt,
      targetId: targets.id,
      targetName: targets.name,
      targetSlug: targets.slug,
      targetLogo: targets.logoUrl,
      projectName: projects.name,
      projectSlug: projects.slug,
    })
    .from(switches)
    .innerJoin(targets, eq(targets.id, switches.targetId))
    .leftJoin(projects, eq(projects.id, switches.projectId))
    .where(eq(switches.userId, userId))
    .orderBy(desc(switches.createdAt));
}

/** Target ids this person has already switched away from. */
export async function getUserSwitchedTargets(userId: string) {
  const rows = await db
    .select({ targetId: switches.targetId })
    .from(switches)
    .where(eq(switches.userId, userId));
  return new Set(rows.map((r) => r.targetId));
}

/** How many people have gone Subless on a given subscription. */
export async function getTargetSwitchCount(targetId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(switches)
    .where(eq(switches.targetId, targetId));
  return row?.n ?? 0;
}

export async function getProjectById(id: number) {
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return row ?? null;
}

/* ────────────────────────────────  Comments  ──────────────────────────────── */

export interface CommentNode {
  id: number;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
  authorId: string | null;
  authorLogin: string | null;
  authorName: string | null;
  authorImage: string | null;
  replies: CommentNode[];
}

/**
 * One query for the whole thread, assembled in memory. Threads are one level
 * deep, so a recursive CTE would be ceremony for no gain — and this keeps the
 * ordering rules (roots newest-first, replies oldest-first) in plain sight.
 */
export async function getComments(
  subjectType: "project" | "contest",
  subjectId: number,
): Promise<CommentNode[]> {
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
      authorId: comments.authorId,
      authorLogin: users.githubLogin,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(and(eq(comments.subjectType, subjectType), eq(comments.subjectId, subjectId)))
    .orderBy(asc(comments.createdAt));

  const byId = new Map<number, CommentNode>();
  for (const r of rows) byId.set(r.id, { ...r, replies: [] });

  const roots: CommentNode[] = [];
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parentId) byId.get(r.parentId)?.replies.push(node);
    else roots.push(node);
  }

  // Newest discussions first, but each thread reads top to bottom
  roots.reverse();
  return roots;
}

/** Total comments on a subject, ignoring deleted ones — for the section heading. */
export async function getCommentCount(
  subjectType: "project" | "contest",
  subjectId: number,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(comments)
    .where(
      and(
        eq(comments.subjectType, subjectType),
        eq(comments.subjectId, subjectId),
        isNull(comments.deletedAt),
      ),
    );
  return row?.n ?? 0;
}

/* ────────────────────────────────  Notifications  ──────────────────────────────── */

export async function getNotifications(userId: string, limit = 50) {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      subjectType: notifications.subjectType,
      subjectTitle: notifications.subjectTitle,
      subjectSlug: notifications.subjectSlug,
      commentId: notifications.commentId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorLogin: users.githubLogin,
      actorName: users.name,
      actorImage: users.image,
      excerpt: comments.body,
      excerptDeletedAt: comments.deletedAt,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .leftJoin(comments, eq(comments.id, notifications.commentId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

/**
 * Does a paid service matching this query already have published alternatives?
 *
 * Someone searching "notion" on the demand page may be about to nominate
 * something the community already replaced. Telling them that is a better answer
 * than an empty list and a blank form.
 */
export async function findCoveredTarget(q: string) {
  const needle = `%${q.trim()}%`;
  const [row] = await db
    .select({
      slug: targets.slug,
      name: targets.name,
      logoUrl: targets.logoUrl,
      monthlyPriceUsd: targets.monthlyPriceUsd,
      alternatives: sql<number>`count(distinct ${projects.id})::int`,
    })
    .from(targets)
    .innerJoin(projectTargets, eq(projectTargets.targetId, targets.id))
    .innerJoin(
      projects,
      and(eq(projects.id, projectTargets.projectId), eq(projects.status, "approved")),
    )
    .where(ilike(targets.name, needle))
    .groupBy(targets.id)
    .orderBy(desc(sql`count(distinct ${projects.id})`))
    .limit(1);

  return row ?? null;
}

/* ────────────────────────────────  Profiles  ──────────────────────────────── */

export async function getProfileByLogin(login: string) {
  const [row] = await db
    .select({
      id: users.id,
      login: users.githubLogin,
      name: users.name,
      image: users.image,
      isAdmin: users.isAdmin,
      githubCreatedAt: users.githubCreatedAt,
      joinedAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.githubLogin, login))
    .limit(1);
  return row ?? null;
}

/** Everything this person has published, newest first. */
export async function getProfileBuilds(userId: string) {
  const rows = await db
    .select(projectCard)
    .from(projects)
    .leftJoin(projectMetrics, eq(projectMetrics.projectId, projects.id))
    .leftJoin(users, eq(users.id, projects.submittedById))
    .where(and(eq(projects.submittedById, userId), eq(projects.status, "approved")))
    .orderBy(desc(sql`coalesce(${projectMetrics.score}, 0)`));

  return attachTargets(rows);
}

/** Challenges this person has won, for the profile timeline. */
export async function getProfileWins(userId: string) {
  return db
    .select({
      contestSlug: contests.slug,
      contestTitle: contests.title,
      endsAt: contests.endsAt,
      projectName: projects.name,
      projectSlug: projects.slug,
    })
    .from(contests)
    .innerJoin(projects, eq(projects.id, contests.winnerProjectId))
    .where(eq(projects.submittedById, userId))
    .orderBy(desc(contests.endsAt));
}

/* ────────────────────────────────  Builder leaderboard  ──────────────────────────────── */

export interface BuilderRow {
  id: string;
  login: string;
  name: string | null;
  image: string | null;
  builds: number;
  totalScore: number;
  wins: number;
  adoptions: number;
  adoptedAnnualUsd: number;
  coversAnnualUsd: number;
}

/**
 * Ranks people, not projects.
 *
 * Three separate aggregates merged in memory rather than one wide join: joining
 * switches, contests and project metrics in a single statement fans the rows out
 * and silently multiplies the sums. The builder count is small, and being
 * obviously correct matters more here than saving two round trips.
 *
 * Order follows the brand's own yardstick — money actually cancelled first, then
 * challenge wins, then the reach of their published work. A builder whose
 * alternatives people genuinely switched to outranks one with more stars.
 */
export async function getBuilderLeaderboard(): Promise<BuilderRow[]> {
  const base = await db
    .select({
      id: users.id,
      login: users.githubLogin,
      name: users.name,
      image: users.image,
      builds: sql<number>`count(distinct ${projects.id})::int`,
      totalScore: sql<number>`coalesce(sum(coalesce(${projectMetrics.score}, 0)), 0)::real`,
    })
    .from(users)
    .innerJoin(
      projects,
      and(eq(projects.submittedById, users.id), eq(projects.status, "approved")),
    )
    .leftJoin(projectMetrics, eq(projectMetrics.projectId, projects.id))
    .groupBy(users.id);

  const winRows = await db
    .select({ id: projects.submittedById, wins: sql<number>`count(*)::int` })
    .from(contests)
    .innerJoin(projects, eq(projects.id, contests.winnerProjectId))
    .groupBy(projects.submittedById);
  const winsBy = new Map(winRows.map((r) => [r.id, r.wins]));

  const adoptionRows = await db
    .select({
      id: projects.submittedById,
      people: sql<number>`count(distinct ${switches.userId})::int`,
      annual: sql<number>`coalesce(sum(${switches.annualUsd}), 0)::real`,
    })
    .from(switches)
    .innerJoin(projects, eq(projects.id, switches.projectId))
    .groupBy(projects.submittedById);
  const adoptionBy = new Map(adoptionRows.map((r) => [r.id, r]));

  // What their published work could replace, counted once per service
  const coverRows = await db
    .select({
      id: projects.submittedById,
      annual: sql<number>`coalesce(sum(distinct ${targets.monthlyPriceUsd}), 0)::real`,
    })
    .from(targets)
    .innerJoin(projectTargets, eq(projectTargets.targetId, targets.id))
    .innerJoin(
      projects,
      and(eq(projects.id, projectTargets.projectId), eq(projects.status, "approved")),
    )
    .groupBy(projects.submittedById);
  const coverBy = new Map(coverRows.map((r) => [r.id, r.annual]));

  return base
    .filter((b): b is typeof b & { login: string } => Boolean(b.login))
    .map((b) => ({
      ...b,
      totalScore: Math.round(b.totalScore * 10) / 10,
      wins: winsBy.get(b.id) ?? 0,
      adoptions: adoptionBy.get(b.id)?.people ?? 0,
      adoptedAnnualUsd: Math.round(adoptionBy.get(b.id)?.annual ?? 0),
      coversAnnualUsd: Math.round((coverBy.get(b.id) ?? 0) * 12),
    }))
    .sort(
      (a, b) =>
        b.adoptedAnnualUsd - a.adoptedAnnualUsd ||
        b.wins - a.wins ||
        b.totalScore - a.totalScore ||
        b.builds - a.builds,
    );
}

/** Categories that actually contain a nomination, busiest first. */
export async function getNominationCategories() {
  const rows = await db
    .select({
      slug: categories.slug,
      name: categories.name,
      emoji: categories.emoji,
      count: sql<number>`count(distinct ${nominations.id})::int`,
    })
    .from(categories)
    .innerJoin(targets, eq(targets.categoryId, categories.id))
    .innerJoin(
      nominations,
      and(eq(nominations.targetId, targets.id), eq(nominations.status, "approved")),
    )
    .groupBy(categories.id)
    .orderBy(desc(sql`count(distinct ${nominations.id})`), asc(categories.name));

  return rows;
}

/** Repository insights for the project page. Absent until the first sync runs. */
export async function getGithubDetails(projectId: number) {
  const [row] = await db
    .select()
    .from(githubDetails)
    .where(eq(githubDetails.projectId, projectId))
    .limit(1);
  return row ?? null;
}

/* ────────────────────────────────  Testing  ──────────────────────────────── */

export interface TestSummary {
  testers: number;
  /** Share of testers who found each requirement met, in the challenge's order. */
  coverage: number[];
  /** Mean across requirements — the community rating for this build. */
  overall: number;
  reports: {
    id: number;
    note: string | null;
    createdAt: Date;
    metCount: number;
    total: number;
    authorLogin: string | null;
    authorName: string | null;
    authorImage: string | null;
  }[];
}

/**
 * How well a build covers its challenge's requirements, as judged by testers.
 *
 * Coverage is computed against the challenge's *current* requirement list and
 * matched by text, so a report written before an edit still counts for the lines
 * that survived. A requirement nobody has tested reads as zero coverage with
 * zero testers, which is honestly different from "tested and failing".
 */
export async function getTestSummary(
  entryId: number,
  requirements: string[],
): Promise<TestSummary> {
  const rows = await db
    .select({
      id: testReports.id,
      items: testReports.items,
      note: testReports.note,
      createdAt: testReports.createdAt,
      authorLogin: users.githubLogin,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(testReports)
    .leftJoin(users, eq(users.id, testReports.userId))
    .where(eq(testReports.entryId, entryId))
    .orderBy(desc(testReports.createdAt));

  const counts = requirements.map(() => ({ met: 0, judged: 0 }));

  for (const row of rows) {
    for (const item of row.items) {
      const index = requirements.indexOf(item.requirement);
      if (index === -1) continue;
      counts[index].judged++;
      if (item.met) counts[index].met++;
    }
  }

  const coverage = counts.map((c) => (c.judged === 0 ? 0 : c.met / c.judged));
  const overall = coverage.length
    ? coverage.reduce((sum, c) => sum + c, 0) / coverage.length
    : 0;

  return {
    testers: rows.length,
    coverage,
    overall,
    reports: rows.map((r) => ({
      id: r.id,
      note: r.note,
      createdAt: r.createdAt,
      metCount: r.items.filter((i) => i.met).length,
      total: r.items.length,
      authorLogin: r.authorLogin,
      authorName: r.authorName,
      authorImage: r.authorImage,
    })),
  };
}

/** This person's own report, so the form opens pre-filled rather than blank. */
export async function getMyTestReport(entryId: number, userId: string) {
  const [row] = await db
    .select({ items: testReports.items, note: testReports.note })
    .from(testReports)
    .where(and(eq(testReports.entryId, entryId), eq(testReports.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Community rating for a build: how much of what challenges asked for testers
 * actually found working, averaged across every challenge it entered.
 *
 * Grounded in the requirement checklists rather than a star widget. A five-star
 * average tells you people liked it; this tells you which promises it keeps.
 */
export async function getProjectTestRating(projectId: number) {
  const entries = await db
    .select({
      entryId: contestEntries.id,
      requirements: contests.requirements,
      contestTitle: contests.title,
      contestSlug: contests.slug,
    })
    .from(contestEntries)
    .innerJoin(contests, eq(contests.id, contestEntries.contestId))
    .where(eq(contestEntries.projectId, projectId));

  if (entries.length === 0) return null;

  const perChallenge = [];
  for (const entry of entries) {
    if (entry.requirements.length === 0) continue;
    const summary = await getTestSummary(entry.entryId, entry.requirements);
    if (summary.testers === 0) continue;
    perChallenge.push({
      title: entry.contestTitle,
      slug: entry.contestSlug,
      testers: summary.testers,
      verified: summary.coverage.filter((c) => c >= 0.5).length,
      total: entry.requirements.length,
      overall: summary.overall,
    });
  }

  if (perChallenge.length === 0) return null;

  const testers = perChallenge.reduce((sum, c) => sum + c.testers, 0);
  const rating =
    perChallenge.reduce((sum, c) => sum + c.overall, 0) / perChallenge.length;

  return { rating, testers, perChallenge };
}
