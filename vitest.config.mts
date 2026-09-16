import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    // The cycle engine mutates shared state, so tests must not interleave
    fileParallelism: false,
    env: {
      // An in-memory Postgres per run: real SQL, no file to corrupt, nothing to clean up
      PGLITE_DIR: "memory://",
      DATABASE_URL: "",
    },
  },
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "./src") },
  },
});
