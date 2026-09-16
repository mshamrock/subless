import { BRAND } from "@/lib/brand";
import type { Email } from "./send";

/**
 * Deliberately plain.
 *
 * Gmail's tab classifier reads design as intent: a dark card with a big coloured
 * call-to-action button is the visual grammar of marketing, and it lands in
 * Promotions no matter how transactional the content is. These messages are
 * light, mostly text, and link with ordinary underlined links rather than
 * buttons — the aim is for them to look like a person wrote them, because
 * functionally that is what they are.
 *
 * Hand-written HTML rather than a rendering library: mail clients punish clever
 * markup, and every message ships a plain-text twin.
 *
 * One deliberate asymmetry: only the weekly digest sets `unsubscribeUrl`, which
 * is what adds the List-Unsubscribe headers. Those headers are required of bulk
 * senders — and they also tell Gmail "this is list mail", which is exactly the
 * classification a digest deserves and exactly the wrong one for a reply to your
 * comment. The transactional messages still carry an unsubscribe link in the
 * body, which is what someone actually looks for.
 */
function layout(body: string, unsubscribeUrl: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#ffffff;color:#1a1d21;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">
  <div style="max-width:480px;margin:0 auto;">
    ${body}
    <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e6e8eb;color:#6b7280;font-size:13px;line-height:1.5;">
      You are getting this because you signed in to ${BRAND.name}.
      <a href="${unsubscribeUrl}" style="color:#6b7280;">Unsubscribe</a>.
    </p>
  </div>
</body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 14px;">${t}</p>`;
const link = (href: string, label: string) =>
  `<a href="${href}" style="color:#1a1d21;">${label}</a>`;

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

function quote(t: string): string {
  return `<blockquote style="margin:0 0 14px;padding:2px 0 2px 12px;border-left:3px solid #d7dade;color:#4b5158;">${escape(t.slice(0, 280))}</blockquote>`;
}

export function replyEmail(opts: {
  to: string;
  actor: string;
  subjectTitle: string;
  excerpt: string;
  url: string;
  unsubscribeUrl: string;
}): Email {
  const body =
    p(`${escape(opts.actor)} replied to your comment on ${escape(opts.subjectTitle)}:`) +
    quote(opts.excerpt) +
    p(link(opts.url, "Read and reply"));

  return {
    to: opts.to,
    subject: `Re: your comment on ${opts.subjectTitle}`,
    html: layout(body, opts.unsubscribeUrl),
    text: `${opts.actor} replied to your comment on ${opts.subjectTitle}:\n\n  ${opts.excerpt.slice(0, 280)}\n\nRead and reply: ${opts.url}\n\nUnsubscribe: ${opts.unsubscribeUrl}`,
    // No List-Unsubscribe header on purpose — see the note below
  };
}

export function projectCommentEmail(opts: {
  to: string;
  actor: string;
  subjectTitle: string;
  excerpt: string;
  url: string;
  unsubscribeUrl: string;
}): Email {
  const body =
    p(`${escape(opts.actor)} commented on ${escape(opts.subjectTitle)}:`) +
    quote(opts.excerpt) +
    p(link(opts.url, "Read and reply"));

  return {
    to: opts.to,
    subject: `New comment on ${opts.subjectTitle}`,
    html: layout(body, opts.unsubscribeUrl),
    text: `${opts.actor} commented on ${opts.subjectTitle}:\n\n  ${opts.excerpt.slice(0, 280)}\n\nRead and reply: ${opts.url}\n\nUnsubscribe: ${opts.unsubscribeUrl}`,
    // No List-Unsubscribe header on purpose — see the note below
  };
}

export function weeklyEmail(opts: {
  to: string;
  building: { title: string; slug: string } | null;
  voting: { title: string; slug: string } | null;
  winner: { challenge: string; project: string; slug: string } | null;
  unsubscribeUrl: string;
}): Email {
  const html: string[] = [];
  const text: string[] = [];

  if (opts.winner) {
    const url = `${BRAND.url}/projects/${opts.winner.slug}`;
    html.push(
      p(
        `<strong>${escape(opts.winner.project)}</strong> won ${escape(opts.winner.challenge)}. You can go Subless on it now — ${link(url, "see the winner")}.`,
      ),
    );
    text.push(`${opts.winner.project} won ${opts.winner.challenge}. You can go Subless on it now.\n  ${url}`);
  }

  if (opts.voting) {
    const url = `${BRAND.url}/challenges/${opts.voting.slug}`;
    html.push(
      p(
        `Voting is open on ${escape(opts.voting.title)} and closes in a week — one vote each. ${link(url, "Vote")}.`,
      ),
    );
    text.push(`Voting is open on ${opts.voting.title}, closing in a week. One vote each.\n  ${url}`);
  }

  if (opts.building) {
    const url = `${BRAND.url}/challenges/${opts.building.slug}`;
    html.push(
      p(
        `This week's challenge is ${escape(opts.building.title)}. Seven days — ${link(url, "see the requirements")}.`,
      ),
    );
    text.push(`This week's challenge: ${opts.building.title}. Seven days to build it.\n  ${url}`);
  }

  // A specific subject beats a branded one: "This week on Subless" is the exact
  // phrasing a newsletter uses, and it gets filed like one
  const subject = opts.winner
    ? `${opts.winner.project} won the ${opts.winner.challenge} challenge`
    : opts.voting
      ? `Voting is open: ${opts.voting.title}`
      : opts.building
        ? `This week: ${opts.building.title}`
        : "This week on Subless";

  return {
    to: opts.to,
    subject,
    html: layout(html.join(""), opts.unsubscribeUrl),
    text: `${text.join("\n\n")}\n\nUnsubscribe: ${opts.unsubscribeUrl}`,
    unsubscribeUrl: opts.unsubscribeUrl,
  };
}
