"use client";

import Link from "next/link";

/** Shown instead of a bare 500 when a page fails, e.g. while the database is unavailable. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Something went wrong on our side</h1>
      <p className="mt-4 text-[var(--color-muted)]">
        This page could not load its data. It is usually back within a few minutes.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <button type="button" className="btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/how-it-works" className="btn-ghost">
          How it works
        </Link>
      </div>
    </div>
  );
}
