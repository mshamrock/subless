/**
 * Canonical brand copy, kept in one place so the voice cannot drift page by page.
 * Source: Subless Marketing Brief, September 2026 (§20 Canonical brand copy).
 */
export const BRAND = {
  name: "Subless",
  domain: "gosubless.com",
  url: "https://gosubless.com",

  /** The action. The domain works because the brand becomes a verb. */
  cta: "Go Subless",
  /** The core idea. */
  tagline: "Stop renting software.",
  /** The supporting line. */
  support: "Build free alternatives together.",
  /** The mechanism. */
  mechanism: "Demand first. Build second.",
  /** The promise. */
  promise: "Free. Community-built. No subscription.",

  /** Five-second explanation. */
  short: "Free community-built alternatives to SaaS subscriptions.",
  /** One sentence. */
  sentence:
    "Subless is a free community where people vote for software subscriptions they want replaced and builders create free alternatives together.",
} as const;

/** "Go Subless on Calendly." — connect a specific paid product to the action. */
export function goSublessOn(product: string): string {
  return `${BRAND.cta} on ${product}`;
}

/** The six steps of the Subless model (§4). */
export const PIPELINE = [
  { n: "01", name: "Submit", body: "Someone nominates a paid product they want replaced." },
  { n: "02", name: "Vote", body: "The community validates demand and pushes the strongest requests up." },
  { n: "03", name: "Build", body: "Builders join the challenge and create focused alternatives with AI coding tools." },
  { n: "04", name: "Test", body: "Users try the builds, report gaps, and help refine the requirements." },
  { n: "05", name: "Use", body: "The best alternatives earn adoption and reputation." },
  { n: "06", name: "Go Subless", body: "You replace the paid subscription with a community-built one." },
] as const;
