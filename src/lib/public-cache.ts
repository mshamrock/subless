import { unstable_cache } from "next/cache";

/**
 * Data every visitor sees the same way (catalog, contests, stats, leaderboards)
 * is cached for a few minutes instead of being read from Postgres on every
 * request. Each anonymous page view used to wake the database, which burned
 * through the Neon free-tier quota and took the site down.
 *
 * Server actions invalidate the tag on every write (see ./revalidate.ts), so
 * a visitor's own change still shows up immediately.
 */
export const PUBLIC_TAG = "public-data";
const TTL_SECONDS = 600;

// unstable_cache stores results as JSON: keep Dates, Maps and Sets intact
const encode = (v: unknown) =>
  JSON.stringify(v, function (key, value) {
    const raw = (this as Record<string, unknown>)[key];
    if (raw instanceof Date) return { __t: "Date", v: raw.toISOString() };
    if (raw instanceof Map) return { __t: "Map", v: [...raw] };
    if (raw instanceof Set) return { __t: "Set", v: [...raw] };
    return value;
  });

const decode = <T>(s: string): T =>
  JSON.parse(s, (_key, value) => {
    if (value && typeof value === "object" && "__t" in value) {
      if (value.__t === "Date") return new Date(value.v);
      if (value.__t === "Map") return new Map(value.v);
      if (value.__t === "Set") return new Set(value.v);
    }
    return value;
  }) as T;

export function cachedPublic<A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>) {
  // unstable_cache needs the Next.js server runtime; tests call the queries directly
  if (process.env.NODE_ENV === "test") return fn;
  const cached = unstable_cache(async (...args: A) => encode(await fn(...args)), [name], {
    tags: [PUBLIC_TAG],
    revalidate: TTL_SECONDS,
  });
  return async (...args: A): Promise<R> => decode<R>(await cached(...args));
}
