import * as schema from "./schema";

/**
 * One codebase, two environments.
 *   DATABASE_URL set    → postgres.js (Neon / Vercel Postgres) — production
 *   DATABASE_URL empty  → PGlite in ./.data/pg — local dev with no Postgres install
 *
 * PGlite is real Postgres compiled to WASM, so the schema, migrations and SQL
 * are identical in both cases — none of the usual "SQLite locally, Postgres in
 * production" drift.
 */

type Schema = typeof schema;
type AnyDb = import("drizzle-orm/postgres-js").PostgresJsDatabase<Schema> &
  Partial<{ $client: unknown }>;

const globalForDb = globalThis as unknown as { __db?: AnyDb };

function createDb(): AnyDb {
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    const postgres = require("postgres");
    const { drizzle } = require("drizzle-orm/postgres-js");
    const client = postgres(url, { max: 1, prepare: false });
    return drizzle(client, { schema });
  }

  const { PGlite } = require("@electric-sql/pglite");
  const { drizzle } = require("drizzle-orm/pglite");
  const client = new PGlite(process.env.PGLITE_DIR ?? "./.data/pg");
  return drizzle(client, { schema }) as unknown as AnyDb;
}

function getDb(): AnyDb {
  if (!globalForDb.__db) globalForDb.__db = createDb();
  return globalForDb.__db;
}

/**
 * Connect lazily on first use rather than at import time. `next build` imports
 * every route module across several workers, and eagerly opening PGlite meant
 * each worker fought over the same on-disk database directory.
 */
export const db: AnyDb = new Proxy({} as AnyDb, {
  get: (_target, prop) => Reflect.get(getDb(), prop),
  has: (_target, prop) => Reflect.has(getDb(), prop),
  // drizzle's `is()` walks the prototype chain to identify the dialect, which is
  // how the Auth.js adapter detects Postgres. Without this trap it sees a bare
  // object and refuses the database.
  getPrototypeOf: () => Object.getPrototypeOf(getDb()),
});

export { schema };
export const usingPglite = !process.env.DATABASE_URL?.trim();
