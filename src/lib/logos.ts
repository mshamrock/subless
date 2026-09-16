/**
 * Product icons are fetched once, server-side, and stored with the target.
 *
 * The obvious shortcut is to point <img> at a favicon service and let every
 * visitor's browser fetch it. This catalog recommends Plausible and Umami for
 * not tracking people, so shipping a third-party request on every page view
 * would undercut the whole premise. Fetching once and serving the bytes from
 * our own origin costs a few KB per service and keeps visitors' requests here.
 */

const MAX_ICON_BYTES = 200 * 1024;
const ALLOWED_TYPES = ["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/jpeg", "image/svg+xml", "image/webp", "image/gif"];

export interface FetchedIcon {
  data: string;
  contentType: string;
}

function hostOf(websiteUrl: string): string | null {
  try {
    const url = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`);
    return url.hostname || null;
  } catch {
    return null;
  }
}

async function tryFetch(url: string): Promise<FetchedIcon | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "subless-icon-fetcher" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.includes(contentType)) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    // A zero-byte or absurdly large response is not a usable icon
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_ICON_BYTES) return null;

    return { data: buffer.toString("base64"), contentType };
  } catch {
    return null;
  }
}

/**
 * Sources are tried in order of how likely they are to return a real logo
 * rather than a generic placeholder. DuckDuckGo's endpoint resolves the icon
 * a site actually declares in its HTML, which /favicon.ico often does not.
 */
export async function fetchProductIcon(websiteUrl: string | null): Promise<FetchedIcon | null> {
  if (!websiteUrl) return null;
  const host = hostOf(websiteUrl);
  if (!host) return null;

  const candidates = [
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://${host}/favicon.ico`,
    `https://${host}/apple-touch-icon.png`,
  ];

  // Product subdomains often serve no icon of their own — analytics.google.com
  // has none while google.com does. Falling back to the registrable domain gives
  // the parent brand's mark, which is still the right company's logo.
  const base = host.split(".").slice(-2).join(".");
  if (base !== host) {
    candidates.push(`https://icons.duckduckgo.com/ip3/${base}.ico`);
  }

  for (const candidate of candidates) {
    const icon = await tryFetch(candidate);
    if (icon) return icon;
  }
  return null;
}

/** The internal URL an icon is served from once stored. */
export function iconUrl(slug: string): string {
  return `/api/targets/${slug}/icon`;
}
