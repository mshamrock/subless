import { createConnection } from "node:net";

/**
 * PGlite is a single-process, file-backed engine with no cross-process locking.
 * If a CLI script opens ./.data/pg while `next dev` already holds it, the WASM
 * runtime aborts and the database directory is left corrupted.
 *
 * There is no lock to check, so we use the next best proxy: a listening dev
 * server on the configured port. Production (DATABASE_URL set) is a real
 * Postgres server and has no such restriction, so the guard steps aside.
 */
export async function assertDatabaseFree(
  command?: string,
  /** The /admin button that does the same job inside the server process. */
  adminAction?: string,
  port = Number(process.env.PORT ?? 3000),
) {
  // A real Postgres server has no single-process restriction, so this guard is
  // only ever about the local PGlite file. That also makes `npm run db:push`
  // safe to run inside a Vercel build, where DATABASE_URL is always set.
  if (process.env.DATABASE_URL?.trim()) return;

  const inUse = await new Promise<boolean>((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.setTimeout(400);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });

  if (!inUse) return;

  const rerun = command ? `re-run \`npm run ${command}\`` : "re-run this command";
  const alternative = adminAction
    ? `\nOr, without stopping anything, use the "${adminAction}" button in /admin —\n` +
      "it does the same work inside the server process.\n"
    : "";

  console.error(
    `\nThe dev server appears to be running on port ${port}.\n` +
      "PGlite allows only one process at a time, and opening it twice corrupts\n" +
      `the database directory.\n\nStop the dev server and ${rerun}.\n${alternative}`,
  );
  process.exit(1);
}
