import Link from "next/link";
import { auth } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { SignInButton, SignOutButton } from "./auth-buttons";
import { Avatar } from "./avatar";
import { SublessMark } from "./subless-mark";
import { NotificationBell } from "./notification-bell";

/**
 * Nav order follows the brief's mechanism — demand first, build second.
 * "Most wanted" leads because Subless is explicitly not a directory of
 * alternatives that already exist; the catalog is what the challenges leave behind.
 */
const NAV = [
  { href: "/wanted", label: "Most wanted" },
  { href: "/challenges", label: "Challenges" },
  { href: "/catalog", label: "Alternatives" },
  { href: "/leaderboard", label: "Builders" },
];

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <SublessMark size={32} />
          <span className="hidden text-[15px] font-semibold tracking-tight sm:block">
            {BRAND.name}
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/wanted" className="btn-primary hidden sm:inline-flex">
            Nominate a subscription
          </Link>

          {user ? (
            <div className="flex items-center gap-1.5">
              <NotificationBell userId={user.id} />
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="chip border-[var(--color-acid-dim)]/40 text-[var(--color-acid)]"
                >
                  admin
                </Link>
              )}
              {/* The avatar is the door to your own account, which is where
                  people instinctively click for it */}
              <Link
                href={user.githubLogin ? `/builders/${user.githubLogin}` : "/settings"}
                title="Your profile"
                className="rounded-full ring-offset-2 ring-offset-[var(--color-bg)] transition-shadow hover:ring-2 hover:ring-[var(--color-acid-dim)]"
              >
                <Avatar src={user.image} name={user.githubLogin ?? user.name ?? "?"} size={32} />
              </Link>

              <SignOutButton />
            </div>
          ) : (
            <SignInButton label="Sign in" />
          )}
        </div>
      </div>
    </header>
  );
}
