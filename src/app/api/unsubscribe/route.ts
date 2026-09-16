import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * RFC 8058 one-click: the mail client POSTs here without the person ever seeing
 * a page, so this must succeed silently and never ask for confirmation.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (token) {
    await db.update(users).set({ emailOptIn: false }).where(eq(users.unsubscribeToken, token));
  }
  return new Response(null, { status: 200 });
}

/**
 * Unsubscribe works from the token alone, with no session.
 *
 * Requiring a login to stop receiving mail is a dark pattern, and the token
 * grants nothing except turning its own emails off.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");

  const page = (heading: string, body: string) =>
    new Response(
      `<!doctype html><html><head><meta charset="utf-8"><title>${heading} · ${BRAND.name}</title>
<meta name="robots" content="noindex"></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0b0d;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<div style="max-width:420px;padding:32px;text-align:center;">
  <div style="display:inline-block;width:36px;height:36px;line-height:36px;border-radius:9px;background:#c9f24d;color:#0a0b0d;font-weight:700;font-size:20px;">S</div>
  <h1 style="margin:20px 0 10px;color:#e9ebef;font-size:22px;">${heading}</h1>
  <p style="margin:0 0 22px;color:#8a919d;font-size:15px;line-height:1.55;">${body}</p>
  <a href="${BRAND.url}" style="color:#c9f24d;font-size:14px;">Back to ${BRAND.domain}</a>
</div></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );

  if (!token) return page("Link is incomplete", "This unsubscribe link is missing its token.");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.unsubscribeToken, token))
    .limit(1);

  if (!user) {
    return page(
      "Link not recognised",
      "This link is no longer valid. You can turn emails off from your account at any time.",
    );
  }

  await db.update(users).set({ emailOptIn: false }).where(eq(users.id, user.id));

  return page(
    "You are unsubscribed",
    "No more emails from Subless. Everything still shows up in the bell when you visit.",
  );
}
