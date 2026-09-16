import { BRAND } from "@/lib/brand";
import { getFeedContests } from "@/lib/queries";
import { formatDate, formatYearly } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * The weekly heartbeat, as a feed.
 *
 * Items are *moments*, not challenges. A challenge lives for three weeks and
 * changes twice while it does, so one item per challenge would announce it once
 * and then silently rewrite itself — a subscriber would never hear that voting
 * opened or that a winner launched. Splitting it into three items with stable
 * guids reproduces exactly what the README promises: two things happen every
 * week, and a reader sees both.
 *
 * This exists because a newsletter or aggregator will take a feed and will not
 * take an account. It is the one distribution channel that costs nothing to run
 * and nothing for the other side to adopt.
 */

type Phase = "queued" | "building" | "voting" | "finished" | "archived";

/** How far a challenge has got, so a date passing alone never announces a phase. */
const PHASE_ORDER: Record<Phase, number> = {
  queued: 0,
  building: 1,
  voting: 2,
  finished: 3,
  archived: 4,
};

interface FeedItem {
  guid: string;
  link: string;
  title: string;
  /** HTML, escaped into <description> at render time. */
  body: string;
  date: Date;
  category: string;
}

/**
 * Apostrophes are deliberately left alone. They need no escaping in an XML text
 * node, and every attribute written here is double-quoted — but a reader that
 * unescapes the description and hands the result to an HTML parser would show a
 * literal &apos; to anyone still on an HTML4 parser. A briefing full of
 * "the guest&apos;s side" is a worse bug than a theoretical one.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraph(text: string): string {
  return `<p>${escapeXml(text)}</p>`;
}

function requirementList(requirements: string[]): string {
  if (requirements.length === 0) return "";
  return `<p><strong>What it has to do:</strong></p><ul>${requirements
    .map((r) => `<li>${escapeXml(r)}</li>`)
    .join("")}</ul>`;
}

export async function GET() {
  const contests = await getFeedContests();
  const now = Date.now();
  const items: FeedItem[] = [];

  for (const c of contests) {
    const reached = PHASE_ORDER[(c.status as Phase) ?? "queued"] ?? 0;
    const link = `${BRAND.url}/challenges/${c.slug}`;
    const service = c.targetName ?? c.title;
    const price =
      c.targetMonthlyPriceUsd != null
        ? `<p>${escapeXml(formatYearly(c.targetMonthlyPriceUsd))} is what ${escapeXml(service)} costs to keep.</p>`
        : "";

    if (reached >= PHASE_ORDER.building && c.buildingStartsAt && c.buildingStartsAt.getTime() <= now) {
      items.push({
        guid: `${link}#building`,
        link,
        title: `Build week: ${service}`,
        date: c.buildingStartsAt,
        category: "Build week",
        body:
          paragraph(c.brief) +
          price +
          requirementList(c.requirements ?? []) +
          `<p><a href="${escapeXml(`${BRAND.url}/submit?challenge=${c.slug}`)}">Publish a build</a> — it enters the challenge in one step.</p>`,
      });
    }

    if (reached >= PHASE_ORDER.voting && c.votingStartsAt && c.votingStartsAt.getTime() <= now) {
      const entries =
        c.entryCount === 1 ? "1 build was entered" : `${c.entryCount} builds were entered`;
      items.push({
        guid: `${link}#voting`,
        link,
        title: `Voting open: ${service}`,
        date: c.votingStartsAt,
        category: "Voting",
        body:
          `<p>Entries are closed and ${escapeXml(entries)}. One vote per person${
            c.endsAt ? `, until ${escapeXml(formatDate(c.endsAt))}` : ""
          }.</p>` +
          requirementList(c.requirements ?? []) +
          `<p><a href="${escapeXml(link)}">See the entries and vote</a>.</p>`,
      });
    }

    if (reached >= PHASE_ORDER.finished && c.endsAt && c.endsAt.getTime() <= now) {
      const winner = c.winnerSlug
        ? `<p><strong><a href="${escapeXml(`${BRAND.url}/projects/${c.winnerSlug}`)}">${escapeXml(
            c.winnerName ?? "The winner",
          )}</a></strong>${c.winnerTagline ? ` — ${escapeXml(c.winnerTagline)}` : ""}</p>`
        : `<p>No entry won this one.</p>`;
      items.push({
        guid: `${link}#finished`,
        link,
        title: c.winnerSlug
          ? `Launched: ${c.winnerName} replaces ${service}`
          : `Closed: ${service}`,
        date: c.endsAt,
        category: "Launched",
        body:
          winner +
          price +
          (c.targetSlug
            ? `<p><a href="${escapeXml(`${BRAND.url}/alternatives/${c.targetSlug}`)}">Every alternative to ${escapeXml(service)}</a>.</p>`
            : ""),
      });
    }
  }

  items.sort((a, b) => b.date.getTime() - a.date.getTime());
  const recent = items.slice(0, 50);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${BRAND.name} — ${BRAND.tagline}`)}</title>
    <link>${BRAND.url}/challenges</link>
    <description>${escapeXml(BRAND.sentence)}</description>
    <language>en</language>
    <atom:link href="${BRAND.url}/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${(recent[0]?.date ?? new Date()).toUTCString()}</lastBuildDate>
${recent
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>
      <category>${escapeXml(item.category)}</category>
      <pubDate>${item.date.toUTCString()}</pubDate>
      <description>${escapeXml(item.body)}</description>
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Readers poll far more often than the weekly tick changes anything
      "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400",
    },
  });
}
