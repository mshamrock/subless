import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold">{BRAND.tagline}</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{BRAND.support}</p>
            <p className="mono mt-3 text-xs text-[var(--color-faint)]">{BRAND.domain}</p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--color-faint)]">
            <Link href="/wanted" className="hover:text-[var(--color-fg)]">Most wanted</Link>
            <Link href="/challenges" className="hover:text-[var(--color-fg)]">Challenges</Link>
            <Link href="/catalog" className="hover:text-[var(--color-fg)]">Alternatives</Link>
            <Link href="/leaderboard" className="hover:text-[var(--color-fg)]">Builders</Link>
            <Link href="/submit" className="hover:text-[var(--color-fg)]">Publish a build</Link>
            <Link href="/savings" className="hover:text-[var(--color-fg)]">Your savings</Link>
            <Link href="/settings" className="hover:text-[var(--color-fg)]">Settings</Link>
            <Link href="/how-it-works" className="hover:text-[var(--color-fg)]">How it works</Link>
          </div>
        </div>

        <p className="mt-8 border-t border-[var(--color-border)] pt-6 text-xs text-[var(--color-faint)]">
          {BRAND.promise} Partnerships that support builds are disclosed and never affect
          voting, ranking or winner selection.
        </p>
      </div>
    </footer>
  );
}
