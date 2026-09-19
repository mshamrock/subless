import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

/**
 * Ends a fragment so another sentence can follow it.
 *
 * Taglines are written as card headings, where a full stop looks fussy — but a
 * meta description puts a second sentence right after one, and "Screenshotter
 * Free and open source" reads as a single broken thought.
 */
export function asSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function timeLeft(until: Date | null | undefined): string {
  if (!until) return "—";
  const ms = until.getTime() - Date.now();
  if (ms <= 0) return "time is up";

  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;

  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" })
    .format(d);
}

/** Hostname without the www, for showing people where a link actually goes. */
export function prettyHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function formatMoney(usd: number | null | undefined): string {
  if (usd == null) return "—";
  return `$${usd % 1 === 0 ? usd : usd.toFixed(2)}`;
}

/**
 * Subscriptions are quoted per year throughout.
 * "$12/mo" reads as harmless; "$144/year" reads as a decision — and the whole
 * premise is that the damage is the annual total, not any single monthly charge.
 */
export function yearlyPrice(monthly: number | null | undefined): number | null {
  return monthly == null ? null : Math.round(monthly * 12);
}

export function formatYearly(monthly: number | null | undefined): string {
  const yearly = yearlyPrice(monthly);
  return yearly == null ? "—" : `$${yearly.toLocaleString("en-US")}/year`;
}

/** Big money, compactly: $1,284,420 → $1.28M */
export function formatMoneyCompact(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 10_000) return `$${Math.round(usd / 1000)}k`;
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}
