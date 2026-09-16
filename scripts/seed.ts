/**
 * Demo data: real categories, real paid services, and real open-source
 * alternatives backed by genuine GitHub repositories.
 *
 * The repositories are real on purpose — after the first sync the leaderboard
 * shows live numbers rather than invented ones, and the scoring formula can be
 * judged in action.
 *
 * The users and votes here are demo-only: without them there is no way to show
 * a contest mid-vote or a winner on the homepage.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";

import { assertDatabaseFree } from "./guard";

config({ path: ".env.local" });

const CATEGORIES = [
  { slug: "screenshots", name: "Screenshots & recording", emoji: "📸" },
  { slug: "whiteboard", name: "Whiteboards & diagrams", emoji: "🎨" },
  { slug: "docs", name: "Docs & notes", emoji: "📝" },
  { slug: "database", name: "Databases & sheets", emoji: "🗂" },
  { slug: "automation", name: "Automation", emoji: "⚡️" },
  { slug: "scheduling", name: "Calendars & meetings", emoji: "📅" },
  { slug: "analytics", name: "Analytics", emoji: "📊" },
  { slug: "email", name: "Email & newsletters", emoji: "✉️" },
  { slug: "hosting", name: "Hosting & deploys", emoji: "🚀" },
  { slug: "design", name: "Design", emoji: "✏️" },
];

const TARGETS = [
  { slug: "gyazo", name: "Gyazo", website: "https://gyazo.com", price: 4.99, category: "screenshots", description: "One-click screenshots with the share link landing straight in your clipboard." },
  { slug: "loom", name: "Loom", website: "https://loom.com", price: 15, category: "screenshots", description: "Screen recording with webcam and transcripts, shareable the moment you stop." },
  { slug: "miro", name: "Miro", website: "https://miro.com", price: 16, category: "whiteboard", description: "An infinite collaborative whiteboard: sticky notes, diagrams, workshops." },
  { slug: "notion", name: "Notion", website: "https://notion.so", price: 10, category: "docs", description: "Knowledge base, documents and databases in one workspace." },
  { slug: "airtable", name: "Airtable", website: "https://airtable.com", price: 20, category: "database", description: "A spreadsheet that behaves like a database, with forms and custom views." },
  { slug: "zapier", name: "Zapier", website: "https://zapier.com", price: 29.99, category: "automation", description: "Wires services together without code on a plain if-this-then-that model." },
  { slug: "calendly", name: "Calendly", website: "https://calendly.com", price: 12, category: "scheduling", description: "A booking link that checks your calendar for you before offering slots." },
  { slug: "google-analytics", name: "Google Analytics", website: "https://analytics.google.com", price: 0, category: "analytics", description: "Web analytics that costs nothing in money and plenty in privacy." },
  { slug: "mailchimp", name: "Mailchimp", website: "https://mailchimp.com", price: 20, category: "email", description: "Mailing lists, campaigns and marketing automation." },
  { slug: "vercel", name: "Vercel", website: "https://vercel.com", price: 20, category: "hosting", description: "Push-to-deploy hosting for frontend apps." },
  { slug: "figma", name: "Figma", website: "https://figma.com", price: 15, category: "design", description: "Collaborative interface design in the browser." },
  { slug: "typeform", name: "Typeform", website: "https://typeform.com", price: 25, category: "docs", description: "Surveys and forms with a pleasant one-question-at-a-time flow." },
];

const PROJECTS = [
  { name: "Flameshot", repo: "flameshot-org/flameshot", targets: ["gyazo"], tagline: "Annotated screenshots with instant upload, entirely free" },
  { name: "ShareX", repo: "ShareX/ShareX", targets: ["gyazo", "loom"], tagline: "Screenshots, screen recording and upload anywhere, endlessly configurable" },
  { name: "Cap", repo: "CapSoftware/Cap", targets: ["loom"], tagline: "Screen recording with a shareable link the moment you stop, open source" },
  { name: "Excalidraw", repo: "excalidraw/excalidraw", targets: ["miro"], tagline: "A whiteboard with hand-drawn diagrams and live collaboration" },
  { name: "tldraw", repo: "tldraw/tldraw", targets: ["miro", "figma"], tagline: "An infinite canvas you can embed inside your own app" },
  { name: "AppFlowy", repo: "AppFlowy-IO/AppFlowy", targets: ["notion"], tagline: "Notes, databases and kanban boards running locally on your machine" },
  { name: "Outline", repo: "outline/outline", targets: ["notion"], tagline: "A team knowledge base with fast search and real permissions" },
  { name: "NocoDB", repo: "nocodb/nocodb", targets: ["airtable"], tagline: "Turns any SQL database into a spreadsheet with forms and views" },
  { name: "n8n", repo: "n8n-io/n8n", targets: ["zapier"], tagline: "Visual automation with real code where you need it, on your own server" },
  { name: "Activepieces", repo: "activepieces/activepieces", targets: ["zapier"], tagline: "Automation with AI agents and an open catalog of integrations" },
  { name: "Cal.com", repo: "calcom/cal.com", targets: ["calendly"], tagline: "Meeting scheduling you can self-host and embed anywhere" },
  { name: "Plausible", repo: "plausible/analytics", targets: ["google-analytics"], tagline: "Lightweight web analytics with no cookies and no personal data" },
  { name: "Umami", repo: "umami-software/umami", targets: ["google-analytics"], tagline: "Self-hosted analytics: one script, zero tracking" },
  { name: "Listmonk", repo: "knadh/listmonk", targets: ["mailchimp"], tagline: "Newsletters to millions of subscribers from a single binary" },
  { name: "Coolify", repo: "coollabsio/coolify", targets: ["vercel"], tagline: "Git-push deploys onto your own server, like the big platforms" },
  { name: "Penpot", repo: "penpot/penpot", targets: ["figma"], tagline: "An interface design editor built on web standards, open and self-hostable" },
  { name: "OpnForm", repo: "JhumanJ/OpnForm", targets: ["typeform"], tagline: "Good-looking forms and surveys without a subscription" },
];

/** Demo participants — needed to show a contest with entries and votes. */
const DEMO_USERS = [
  { login: "demo-anna", name: "Anna" },
  { login: "demo-pavel", name: "Pavel" },
  { login: "demo-kirill", name: "Kirill" },
  { login: "demo-lena", name: "Lena" },
  { login: "demo-oleg", name: "Oleg" },
];

const WEEK = 7 * 86_400_000;

async function main() {
  await assertDatabaseFree("db:seed");
  const { db } = await import("../src/lib/db");
  const s = await import("../src/lib/db/schema");
  const { parseRepoUrl } = await import("../src/lib/github");
  const { slugify } = await import("../src/lib/utils");
  const { eq } = await import("drizzle-orm");

  console.log("Clearing previous demo data…");
  for (const table of [
    s.contestVotes, s.contestEntries, s.nominationVotes, s.nominations,
    s.contests, s.projectUpvotes, s.githubStats, s.projectMetrics,
    s.projectTargets, s.projects, s.targets, s.categories, s.cycleLog,
  ]) {
    await db.delete(table);
  }
  for (const u of DEMO_USERS) {
    await db.delete(s.users).where(eq(s.users.githubLogin, u.login));
  }

  console.log("Categories…");
  const categoryIds = new Map<string, number>();
  for (const c of CATEGORIES) {
    const [row] = await db.insert(s.categories).values(c).returning();
    categoryIds.set(c.slug, row.id);
  }

  console.log("Paid services…");
  const targetIds = new Map<string, number>();
  for (const t of TARGETS) {
    const [row] = await db
      .insert(s.targets)
      .values({
        slug: t.slug,
        name: t.name,
        websiteUrl: t.website,
        monthlyPriceUsd: t.price,
        description: t.description,
        categoryId: categoryIds.get(t.category)!,
      })
      .returning();
    targetIds.set(t.slug, row.id);
  }

  console.log("Demo participants…");
  const userIds: string[] = [];
  for (const u of DEMO_USERS) {
    const id = randomUUID();
    await db.insert(s.users).values({
      id,
      name: u.name,
      githubLogin: u.login,
      // A year old — demo accounts must clear the voting age threshold
      githubCreatedAt: new Date(Date.now() - 365 * 86_400_000),
      // No avatar on purpose: pointing these at real GitHub user IDs would put
      // real people's faces next to invented names. The monogram fallback covers it.
      image: null,
      // No address either — demo fixtures must never end up in a real send
      email: null,
    });
    userIds.push(id);
  }

  console.log("Projects…");
  const projectIds = new Map<string, number>();
  for (const [i, p] of PROJECTS.entries()) {
    const repo = parseRepoUrl(p.repo)!;
    const [row] = await db
      .insert(s.projects)
      .values({
        slug: slugify(p.name),
        name: p.name,
        tagline: p.tagline,
        repoUrl: `https://github.com/${repo.fullName}`,
        repoFullName: repo.fullName,
        status: "approved",
        approvedAt: new Date(),
        submittedById: userIds[i % userIds.length],
      })
      .returning();

    projectIds.set(p.name, row.id);
    await db.insert(s.projectTargets).values(
      p.targets.map((t) => ({ projectId: row.id, targetId: targetIds.get(t)! })),
    );
  }

  console.log("Upvotes…");
  for (const [name, id] of projectIds) {
    // Deterministic, so the catalog does not reshuffle on every re-seed
    const count = (name.length * 7) % userIds.length;
    for (let i = 0; i < count; i++) {
      await db.insert(s.projectUpvotes).values({ projectId: id, userId: userIds[i] });
    }

    // project_metrics holds a denormalized copy so the catalog never counts rows.
    // Seed it here, otherwise the catalog shows zero upvotes until a sync runs.
    await db
      .insert(s.projectMetrics)
      .values({ projectId: id, upvotes: count })
      .onConflictDoUpdate({ target: s.projectMetrics.projectId, set: { upvotes: count } });
  }

  // Turn those upvotes into a starting score, so the leaderboard is meaningfully
  // ordered even before the first GitHub sync
  const { recomputeScore } = await import("../src/lib/sync");
  for (const id of projectIds.values()) await recomputeScore(id);

  const now = Date.now();

  console.log("Contests…");
  // Phase 3: winner on the homepage
  const [finished] = await db
    .insert(s.contests)
    .values({
      slug: "gyazo-2026-08-31",
      title: "Gyazo alternative",
      targetId: targetIds.get("gyazo")!,
      brief:
        "Replace Gyazo: a hotkey capture, automatic upload, and the link in your clipboard right away. The whole point is that the path from keypress to shareable link takes under two seconds.",
      requirements: [
        "Hotkey to capture a region of the screen",
        "Automatic upload with the link copied to the clipboard",
        "Upload history with the ability to delete",
        "Your own storage, or anything S3-compatible",
      ],
      status: "finished",
      buildingStartsAt: new Date(now - 3 * WEEK),
      votingStartsAt: new Date(now - 2 * WEEK),
      endsAt: new Date(now - WEEK),
      winnerProjectId: projectIds.get("Flameshot")!,
    })
    .returning();

  await seedEntries(db, s, finished.id, ["Flameshot", "ShareX"], projectIds, userIds, true);

  // Phase 2: voting in progress
  const [voting] = await db
    .insert(s.contests)
    .values({
      slug: "calendly-2026-09-07",
      title: "Calendly alternative",
      targetId: targetIds.get("calendly")!,
      brief:
        "We need a public booking link that checks calendar availability itself and creates the event with a video call attached. Paying $12 a month for a time picker is absurd.",
      requirements: [
        "Public page showing available slots",
        "Sync with Google Calendar or CalDAV",
        "Automatic video meeting creation",
        "Confirmation emails and reminders",
        "Time zones handled on the guest's side",
      ],
      status: "voting",
      buildingStartsAt: new Date(now - 2 * WEEK),
      votingStartsAt: new Date(now - 2 * 86_400_000),
      endsAt: new Date(now + 5 * 86_400_000),
    })
    .returning();

  await seedEntries(db, s, voting.id, ["Cal.com", "OpnForm"], projectIds, userIds, false);

  // Phase 1: entries open
  await db.insert(s.contests).values({
    slug: "miro-2026-09-14",
    title: "Miro alternative",
    targetId: targetIds.get("miro")!,
    brief:
      "This week we build a Miro alternative. Not all of Miro — just the minimum people actually open it for: an infinite canvas, sticky notes, and two people able to work on the same board at once.",
    requirements: [
      "Infinite canvas with zoom and panning",
      "Sticky notes, text and basic shapes",
      "Real-time collaborative editing",
      "Invite link that works without signup",
      "Export the board to PNG or SVG",
    ],
    status: "building",
    buildingStartsAt: new Date(now - 86_400_000),
    votingStartsAt: new Date(now + 6 * 86_400_000),
  });

  // Queued
  await db.insert(s.contests).values([
    {
      slug: "airtable-queued",
      title: "Airtable alternative",
      targetId: targetIds.get("airtable")!,
      brief: "A spreadsheet with typed fields, public forms for data entry, and kanban/calendar views.",
      requirements: ["Field types and links between tables", "Public forms", "Kanban and calendar views"],
      status: "queued",
      queuePosition: 1,
    },
    {
      slug: "typeform-queued",
      title: "Typeform alternative",
      targetId: targetIds.get("typeform")!,
      brief: "Step-by-step surveys with branching logic and respectable response analytics.",
      requirements: ["One question per screen", "Branching logic", "Export responses to CSV"],
      status: "queued",
      queuePosition: 2,
    },
  ]);

  console.log("Nominations…");
  const nominationRows = [
    { targetName: "Linear", targetUrl: "https://linear.app", monthlyPriceUsd: 8, status: "approved", pitch: "An issue tracker with a genuinely fast interface. The minimum that matters: keyboard navigation, cycles, and git integration. Everything else in it is optional." },
    { targetName: "Superhuman", targetUrl: "https://superhuman.com", monthlyPriceUsd: 30, status: "approved", pitch: "$30 a month for an email client. Two things there are actually valuable: speed and a keyboard shortcut for everything. Both are reproducible in a week on top of IMAP." },
    { targetName: "Descript", targetUrl: "https://descript.com", monthlyPriceUsd: 24, status: "approved", pitch: "Video editing by editing the transcript. With open speech recognition models the core workflow is already fully buildable." },
    { targetName: "Retool", targetUrl: "https://retool.com", monthlyPriceUsd: 10, status: "approved", pitch: "Internal admin panels assembled from blocks on top of your own database. Needs a builder for tables, forms and buttons with SQL underneath." },
    { targetName: "Intercom", targetUrl: "https://intercom.com", monthlyPriceUsd: 39, status: "pending", pitch: "An on-site support chat with conversation history and a canned-response library." },
  ];

  const { ensureTarget } = await import("../src/lib/targets");

  for (const [i, n] of nominationRows.entries()) {
    // Approved means vetted, so the service joins the catalog and picks up an icon
    const targetId =
      n.status === "approved"
        ? await ensureTarget({
            name: n.targetName,
            websiteUrl: n.targetUrl,
            monthlyPriceUsd: n.monthlyPriceUsd,
            description: n.pitch,
          })
        : null;

    const [row] = await db
      .insert(s.nominations)
      .values({ ...n, targetId, submittedById: userIds[i % userIds.length] })
      .returning();

    if (n.status === "approved") {
      const votes = (nominationRows.length - i) % (userIds.length + 1);
      for (let v = 0; v < votes; v++) {
        await db.insert(s.nominationVotes).values({ nominationId: row.id, userId: userIds[v] });
      }
    }
  }

  console.log("Test reports…");
  // One disagreement on purpose: with every tester agreeing, the coverage bars
  // are all-or-nothing and the averaging is invisible in a fresh install
  const [calEntry] = await db
    .select()
    .from(s.contestEntries)
    .where(eq(s.contestEntries.contestId, voting.id))
    .orderBy(s.contestEntries.id)
    .limit(1);

  if (calEntry) {
    const reqs = [
      "Public page showing available slots",
      "Sync with Google Calendar or CalDAV",
      "Automatic video meeting creation",
      "Confirmation emails and reminders",
      "Time zones handled on the guest's side",
    ];
    await db.insert(s.testReports).values([
      {
        entryId: calEntry.id,
        userId: userIds[3],
        items: reqs.map((r, i) => ({ requirement: r, met: i < 3 })),
        note: "Booking page and calendar sync work. No reminder emails, and the guest timezone is read from the browser rather than asked for.",
      },
      {
        entryId: calEntry.id,
        userId: userIds[4],
        items: reqs.map((r, i) => ({ requirement: r, met: i < 2 })),
        note: "Could not get the video link to generate on my account.",
      },
    ]);
  }

  console.log("Recorded switches…");
  // Without a few of these the North Star reads $0 on a fresh install, which
  // makes the headline metric look broken rather than honest
  const switchFixtures: [string, string][] = [
    ["gyazo", "Flameshot"],
    ["miro", "Excalidraw"],
    ["notion", "AppFlowy"],
    ["zapier", "n8n"],
  ];
  for (const [i, [targetSlug, projectName]] of switchFixtures.entries()) {
    const targetId = targetIds.get(targetSlug)!;
    const target = TARGETS.find((t) => t.slug === targetSlug)!;
    // Spread across users so the count of switchers is meaningful too
    for (let u = 0; u <= i % 3; u++) {
      await db
        .insert(s.switches)
        .values({
          userId: userIds[u],
          targetId,
          projectId: projectIds.get(projectName)!,
          annualUsd: Math.round(target.price * 12),
        })
        .onConflictDoNothing();
    }
  }

  console.log("Comments…");
  // A thread with a reply, so the discussion feature and its reply notification
  // are both visible in a fresh install rather than hiding behind empty state
  const excalidraw = projectIds.get("Excalidraw")!;
  const [rootComment] = await db
    .insert(s.comments)
    .values({
      subjectType: "project",
      subjectId: excalidraw,
      authorId: userIds[0],
      body: "Been running this instead of Miro for a month. The invite link without signup is the part that actually sold my team.",
    })
    .returning();

  await db.insert(s.comments).values({
    subjectType: "project",
    subjectId: excalidraw,
    parentId: rootComment.id,
    authorId: userIds[1],
    body: "Same here. Export to SVG was the one thing I missed, but it landed last release.",
  });

  console.log("\nDone. Next, pull the GitHub metrics:");
  console.log("  npx tsx scripts/sync.ts");
  process.exit(0);
}

async function seedEntries(
  db: Awaited<typeof import("../src/lib/db")>["db"],
  s: typeof import("../src/lib/db/schema"),
  contestId: number,
  projectNames: string[],
  projectIds: Map<string, number>,
  userIds: string[],
  final: boolean,
) {
  for (const [i, name] of projectNames.entries()) {
    const [entry] = await db
      .insert(s.contestEntries)
      .values({
        contestId,
        projectId: projectIds.get(name)!,
        userId: userIds[i],
        note:
          i === 0
            ? "Everything on the checklist, upload history included."
            : "All of it except the self-hosted storage backend.",
        finalVotes: final ? (i === 0 ? 3 : 1) : 0,
        rank: final ? i + 1 : null,
      })
      .returning();

    // Only users who did not submit an entry get to vote
    const voters = userIds.slice(projectNames.length).slice(0, i === 0 ? 3 : 1);
    for (const voter of voters) {
      await db
        .insert(s.contestVotes)
        .values({ contestId, userId: voter, entryId: entry.id })
        .onConflictDoNothing();
    }
  }
}

main().catch((e) => {
  console.error("Seeding failed:", e);
  process.exit(1);
});
