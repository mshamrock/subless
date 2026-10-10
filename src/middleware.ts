import { NextResponse, type NextRequest } from "next/server";

const CANONICAL_HOST = "gosubless.com";

/**
 * One address for the production site.
 *
 * Vercel also serves production on subless.vercel.app and on every deployment's
 * own URL. Signing in there fails outright — GitHub only returns to the callback
 * registered for the OAuth app, which is on gosubless.com — and for search
 * engines it is the same site twice under two names. Sending every other host to
 * the canonical one fixes both, and keeps old links and bookmarks working.
 *
 * Preview deployments are left alone: they are meant to be opened on their own
 * address. Cron is left alone too — it is authorised by its secret, not its host,
 * and a redirect is a step it could fail to follow without anyone noticing.
 */
export function middleware(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") return;

  const host = request.headers.get("host");
  if (!host || host === CANONICAL_HOST) return;

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = CANONICAL_HOST;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image).*)"],
};
