import { BRAND } from "@/lib/brand";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Enables RFC 8058 one-click unsubscribe headers for this message. */
  unsubscribeUrl?: string;
}

/**
 * Where replies go.
 *
 * Notification mail that cannot be replied to is a small act of rudeness from a
 * product whose whole pitch is "we build together" — and mailbox providers read
 * replies as an engagement signal, so a dead-end address costs deliverability too.
 * Set EMAIL_REPLY_TO once notifications move to their own sender; until then the
 * From address is itself replyable and this stays unset.
 */
function replyTo(): string | undefined {
  return process.env.EMAIL_REPLY_TO?.trim() || undefined;
}

export type SendResult = { ok: true; delivered: boolean } | { ok: false; error: string };

/**
 * One seam, two behaviours.
 *
 * With RESEND_API_KEY set, mail goes out. Without it, every message is logged
 * and nothing is sent — so a fresh clone never silently mails real people while
 * someone is testing, and the whole notification path is still exercised end to
 * end in development.
 */
export async function sendEmail(email: Email): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || `${BRAND.name} <noreply@${BRAND.domain}>`;

  if (!key) {
    console.info(
      `[email:dry-run] to=${email.to} subject="${email.subject}"\n` +
        email.text.split("\n").map((l) => `  | ${l}`).join("\n"),
    );
    return { ok: true, delivered: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(replyTo() ? { reply_to: replyTo() } : {}),
        ...(email.unsubscribeUrl
          ? {
              headers: {
                /**
                 * RFC 8058 one-click unsubscribe. Gmail and Yahoo have required
                 * this of bulk senders since 2024, and its absence is read as a
                 * reputation signal — so it matters even at a handful of
                 * recipients, where the sending domain has no history to lean on.
                 */
                "List-Unsubscribe": `<${email.unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }
          : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true, delivered: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Sends to many recipients without letting one failure abort the rest. */
export async function sendAll(emails: Email[]) {
  const result = { attempted: emails.length, delivered: 0, dryRun: 0, failed: [] as string[] };

  for (const email of emails) {
    const r = await sendEmail(email);
    if (!r.ok) result.failed.push(`${email.to}: ${r.error}`);
    else if (r.delivered) result.delivered++;
    else result.dryRun++;
  }

  return result;
}
