import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  real,
  primaryKey,
  uniqueIndex,
  index,
  serial,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ────────────────────────────────  Users and Auth.js  ──────────────────────────────── */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // GitHub specifics: used for display and for anti-vote-stuffing checks
  githubLogin: text("github_login"),
  githubId: integer("github_id"),
  githubCreatedAt: timestamp("github_created_at", { mode: "date" }),
  isAdmin: boolean("is_admin").notNull().default(false),

  /**
   * Email is opt-out rather than opt-in: someone who signed in to take part
   * expects to hear that voting opened. Every message carries a one-click
   * unsubscribe, and the token lets that link work without a session — nobody
   * should have to log in to stop receiving mail.
   */
  emailOptIn: boolean("email_opt_in").notNull().default(true),
  unsubscribeToken: text("unsubscribe_token"),

  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ────────────────────────────────  Catalog  ──────────────────────────────── */

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  emoji: text("emoji"),
});

/** A paid service someone is building an alternative to: Gyazo, Miro, Figma… */
export const targets = pgTable(
  "targets",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    websiteUrl: text("website_url"),
    /**
     * Points at our own /api/targets/<slug>/icon once an icon has been stored.
     * Never a third-party URL: visitors must not be made to fetch images from
     * someone else's server just to browse a catalog that sells privacy.
     */
    logoUrl: text("logo_url"),
    /** The icon itself, base64. Small (favicons run a few KB) and keeps deploys stateless. */
    logoData: text("logo_data"),
    logoContentType: text("logo_content_type"),
    description: text("description"),
    /** What the paid original costs — the savings figure is derived from this */
    monthlyPriceUsd: real("monthly_price_usd"),
    categoryId: integer("category_id").references(() => categories.id),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("targets_category_idx").on(t.categoryId)],
);

/**
 * `hidden` is distinct from `rejected` on purpose. Rejecting says "this does not
 * belong here"; hiding says "not right now" — a broken build, a dead link, a
 * repository gone private. Collapsing them loses the reason, and the reason is
 * what a moderator needs when they come back to it a month later.
 */
export const projectStatus = ["pending", "approved", "hidden", "rejected"] as const;
export type ProjectStatus = (typeof projectStatus)[number];

/** An alternative — the thing a participant actually built */
export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull(),
    description: text("description"),
    repoUrl: text("repo_url").notNull(),
    /** owner/repo extracted from repoUrl — the key for GitHub API calls */
    repoFullName: text("repo_full_name"),
    homepageUrl: text("homepage_url"),
    /** What it was built with: Claude Code, Cursor, Lovable… */
    builtWith: text("built_with"),
    isSelfHosted: boolean("is_self_hosted").notNull().default(true),
    licenseSpdx: text("license_spdx"),

    submittedById: text("submitted_by_id").references(() => users.id, { onDelete: "set null" }),
    /** Confirmed the author actually owns the repo (push access via GitHub API) */
    ownershipVerified: boolean("ownership_verified").notNull().default(false),

    status: text("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { mode: "date" }),
  },
  (t) => [
    index("projects_status_idx").on(t.status),
    uniqueIndex("projects_repo_idx").on(t.repoUrl),
  ],
);

/** A project can be an alternative to several services at once */
export const projectTargets = pgTable(
  "project_targets",
  {
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    targetId: integer("target_id")
      .notNull()
      .references(() => targets.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.targetId] })],
);

/** A GitHub metrics snapshot. History is kept so trends are visible, not just a slice */
export const githubStats = pgTable(
  "github_stats",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    stars: integer("stars").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    watchers: integer("watchers").notNull().default(0),
    openIssues: integer("open_issues").notNull().default(0),
    contributors: integer("contributors").notNull().default(0),
    /** Downloads summed across all release assets (0 for web projects) */
    releaseDownloads: integer("release_downloads").notNull().default(0),
    pushedAt: timestamp("pushed_at", { mode: "date" }),
    /** Final composite score — see lib/score.ts */
    score: real("score").notNull().default(0),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("github_stats_project_idx").on(t.projectId, t.fetchedAt)],
);

/** Denormalized "latest snapshot" so the catalog never joins against history */
export const projectMetrics = pgTable("project_metrics", {
  projectId: integer("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  stars: integer("stars").notNull().default(0),
  forks: integer("forks").notNull().default(0),
  contributors: integer("contributors").notNull().default(0),
  releaseDownloads: integer("release_downloads").notNull().default(0),
  pushedAt: timestamp("pushed_at", { mode: "date" }),
  /** Star growth over the last 7 days */
  starsDelta7d: integer("stars_delta_7d").notNull().default(0),
  upvotes: integer("upvotes").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  score: real("score").notNull().default(0),
  syncedAt: timestamp("synced_at", { mode: "date" }),
  syncError: text("sync_error"),
});

/** A catalog upvote for a project (not the same as a contest vote) */
export const projectUpvotes = pgTable(
  "project_upvotes",
  {
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

/* ────────────────────────────────  Weekly contests  ──────────────────────────────── */

/**
 * A contest lives for three weeks:
 *   queued   → waiting for its slot
 *   building → week 1: entries are accepted
 *   voting   → week 2: the community votes
 *   finished → week 3: the winner sits on the homepage
 *
 * Each weekly tick shifts the whole chain one step forward.
 */
export const contestStatus = ["queued", "building", "voting", "finished", "archived"] as const;
export type ContestStatus = (typeof contestStatus)[number];

export const contests = pgTable(
  "contests",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    targetId: integer("target_id").references(() => targets.id, { onDelete: "set null" }),
    /** Free text: what the MVP is expected to do */
    brief: text("brief").notNull(),
    /** Required features — the checklist voters judge against */
    requirements: text("requirements").array().notNull().default(sql`ARRAY[]::text[]`),

    status: text("status").notNull().default("queued"),
    queuePosition: integer("queue_position").notNull().default(0),

    buildingStartsAt: timestamp("building_starts_at", { mode: "date" }),
    votingStartsAt: timestamp("voting_starts_at", { mode: "date" }),
    endsAt: timestamp("ends_at", { mode: "date" }),

    winnerProjectId: integer("winner_project_id"),
    /** Where the topic came from: a community nomination, or the admin */
    originNominationId: integer("origin_nomination_id"),

    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("contests_status_idx").on(t.status)],
);

export const contestEntries = pgTable(
  "contest_entries",
  {
    id: serial("id").primaryKey(),
    contestId: integer("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    /** Vote snapshot taken at close, so published results never drift */
    finalVotes: integer("final_votes").notNull().default(0),
    rank: integer("rank"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("contest_entries_unique").on(t.contestId, t.projectId)],
);

export const contestVotes = pgTable(
  "contest_votes",
  {
    contestId: integer("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => contestEntries.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  // One vote per person per contest — keyed on (contestId, userId), not entryId
  (t) => [primaryKey({ columns: [t.contestId, t.userId] })],
);

/* ────────────────────────────────  Nominations: what to clone next  ──────────────────────────────── */

export const nominationStatus = ["pending", "approved", "hidden", "rejected", "promoted"] as const;
export type NominationStatus = (typeof nominationStatus)[number];

export const nominations = pgTable(
  "nominations",
  {
    id: serial("id").primaryKey(),
    /** The service may not exist in `targets` yet — then only name and link */
    targetId: integer("target_id").references(() => targets.id, { onDelete: "set null" }),
    targetName: text("target_name").notNull(),
    targetUrl: text("target_url"),
    /** Why this is worth cloning */
    pitch: text("pitch").notNull(),
    monthlyPriceUsd: real("monthly_price_usd"),

    submittedById: text("submitted_by_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    /** Set when the nomination is promoted into a contest */
    promotedContestId: integer("promoted_contest_id").references(() => contests.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("nominations_status_idx").on(t.status)],
);

export const nominationVotes = pgTable(
  "nomination_votes",
  {
    nominationId: integer("nomination_id")
      .notNull()
      .references(() => nominations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.nominationId, t.userId] })],
);

/* ────────────────────────────────  Going Subless  ──────────────────────────────── */

/**
 * A recorded switch: this person stopped paying for this subscription.
 *
 * This is what makes the North Star literal. Without it the headline number can
 * only ever be "cost the catalog *could* replace", which is a projection dressed
 * up as an achievement — and the one number the whole brand rests on is the last
 * place to be loose with the truth.
 *
 * The yearly price is copied in at the moment of the switch. Prices change and
 * targets get edited; someone's recorded saving should not silently drift years
 * later because a vendor raised a plan.
 */
export const switches = pgTable(
  "switches",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetId: integer("target_id")
      .notNull()
      .references(() => targets.id, { onDelete: "cascade" }),
    /** Which build they went with, when they came from one. */
    projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
    /** Annual price at the time of switching, in USD. */
    annualUsd: real("annual_usd").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  // You leave a subscription once; switching again is the same fact, not a new one
  (t) => [
    uniqueIndex("switches_user_target_idx").on(t.userId, t.targetId),
    index("switches_target_idx").on(t.targetId),
  ],
);

/* ────────────────────────────────  Comments  ──────────────────────────────── */

/**
 * Comments attach to anything worth discussing. Kept polymorphic rather than
 * one table per subject: the rendering, moderation and notification rules are
 * identical everywhere, and duplicating them three times invites them to drift.
 */
export const commentSubjects = ["project", "contest"] as const;
export type CommentSubject = (typeof commentSubjects)[number];

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    subjectType: text("subject_type").notNull(),
    subjectId: integer("subject_id").notNull(),

    /**
     * Threads are one level deep. A reply to a reply attaches to the same
     * top-level comment, so a thread can never become an unreadable staircase
     * on a phone — the depth people actually use is one.
     */
    parentId: integer("parent_id").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),

    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),

    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { mode: "date" }),
    /** Soft delete: removing a parent outright would orphan its replies. */
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (t) => [
    index("comments_subject_idx").on(t.subjectType, t.subjectId, t.createdAt),
    index("comments_parent_idx").on(t.parentId),
    index("comments_author_idx").on(t.authorId),
  ],
);

/* ────────────────────────────────  Notifications  ──────────────────────────────── */

export const notificationTypes = ["reply", "comment_on_project"] as const;
export type NotificationType = (typeof notificationTypes)[number];

/**
 * In-app notifications only — there is no mail infrastructure here, and a bell
 * that works beats an email pipeline that is half-built.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    /** Who receives it. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Who caused it. Never equal to userId — nobody is notified of themselves. */
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),

    type: text("type").notNull(),
    commentId: integer("comment_id").references(() => comments.id, { onDelete: "cascade" }),

    /** Denormalized so the list can link out without joining every subject table. */
    subjectType: text("subject_type").notNull(),
    subjectId: integer("subject_id").notNull(),
    subjectTitle: text("subject_title").notNull(),
    subjectSlug: text("subject_slug").notNull(),

    readAt: timestamp("read_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt, t.createdAt)],
);

/* ────────────────────────────────  Housekeeping  ──────────────────────────────── */

/** Weekly tick log — keeps the cycle reproducible and debuggable */
export const cycleLog = pgTable("cycle_log", {
  id: serial("id").primaryKey(),
  ranAt: timestamp("ran_at", { mode: "date" }).notNull().defaultNow(),
  trigger: text("trigger").notNull(), // "cron" | "admin"
  summary: text("summary").notNull(),
  details: text("details"),
});

/* ────────────────────────────────  Relations  ──────────────────────────────── */

export const projectsRelations = relations(projects, ({ one, many }) => ({
  submittedBy: one(users, { fields: [projects.submittedById], references: [users.id] }),
  metrics: one(projectMetrics, {
    fields: [projects.id],
    references: [projectMetrics.projectId],
  }),
  projectTargets: many(projectTargets),
  entries: many(contestEntries),
}));

export const projectTargetsRelations = relations(projectTargets, ({ one }) => ({
  project: one(projects, { fields: [projectTargets.projectId], references: [projects.id] }),
  target: one(targets, { fields: [projectTargets.targetId], references: [targets.id] }),
}));

export const targetsRelations = relations(targets, ({ one, many }) => ({
  category: one(categories, { fields: [targets.categoryId], references: [categories.id] }),
  projectTargets: many(projectTargets),
}));

export const contestsRelations = relations(contests, ({ one, many }) => ({
  target: one(targets, { fields: [contests.targetId], references: [targets.id] }),
  entries: many(contestEntries),
}));

export const contestEntriesRelations = relations(contestEntries, ({ one, many }) => ({
  contest: one(contests, { fields: [contestEntries.contestId], references: [contests.id] }),
  project: one(projects, { fields: [contestEntries.projectId], references: [projects.id] }),
  user: one(users, { fields: [contestEntries.userId], references: [users.id] }),
  votes: many(contestVotes),
}));

export const nominationsRelations = relations(nominations, ({ one, many }) => ({
  target: one(targets, { fields: [nominations.targetId], references: [targets.id] }),
  submittedBy: one(users, { fields: [nominations.submittedById], references: [users.id] }),
  votes: many(nominationVotes),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "replies",
  }),
  replies: many(comments, { relationName: "replies" }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  actor: one(users, { fields: [notifications.actorId], references: [users.id] }),
  comment: one(comments, { fields: [notifications.commentId], references: [comments.id] }),
}));

export const switchesRelations = relations(switches, ({ one }) => ({
  user: one(users, { fields: [switches.userId], references: [users.id] }),
  target: one(targets, { fields: [switches.targetId], references: [targets.id] }),
  project: one(projects, { fields: [switches.projectId], references: [projects.id] }),
}));
