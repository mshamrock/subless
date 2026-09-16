import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAuthorSummary } from "@/lib/queries";
import { Avatar } from "@/components/avatar";
import { EmailToggle } from "@/components/email-toggle";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/settings");

  const [me] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me) redirect("/signin?callbackUrl=/settings");

  const summary = await getAuthorSummary(me.id);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
      </header>

      <section className="card p-6">
        <h2 className="eyebrow mb-4">Account</h2>

        <div className="flex flex-wrap items-center gap-4">
          <Avatar src={me.image} name={me.name ?? me.githubLogin ?? "?"} size={56} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{me.name ?? me.githubLogin}</p>
            <p className="mono text-sm text-[var(--color-muted)]">@{me.githubLogin}</p>
          </div>
          {me.githubLogin && (
            <Link href={`/builders/${me.githubLogin}`} className="btn-ghost">
              View public profile
            </Link>
          )}
        </div>

        {/*
          Everything here comes from GitHub and is changed there, not on this
          site. Rendering editable copies would invite people to change a name
          that silently resets on their next sign-in.
        */}
        <dl className="mt-6 space-y-2 border-t border-[var(--color-border)] pt-5 text-sm">
          <Row label="Email" value={me.email ?? "not shared by GitHub"} />
          <Row label="Joined" value={formatDate(me.createdAt)} />
          <Row
            label="GitHub account age"
            value={
              me.githubCreatedAt
                ? `since ${formatDate(me.githubCreatedAt)}`
                : "unknown"
            }
          />
          {me.isAdmin && <Row label="Role" value="Admin" />}
        </dl>

        <p className="mt-4 text-xs leading-relaxed text-[var(--color-faint)]">
          Your name, avatar and email come from GitHub. Change them there and they update
          here the next time you sign in.
        </p>
      </section>

      <section className="card p-6">
        <h2 className="eyebrow mb-1">Email</h2>
        <p className="mb-5 text-sm text-[var(--color-muted)]">
          The weekly digest when a challenge opens or a vote is settled, and a note when
          someone replies to your comment or comments on your build.
        </p>

        {me.email ? (
          <EmailToggle initial={me.emailOptIn} address={me.email} />
        ) : (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm text-[var(--color-muted)]">
            GitHub did not share an email address with us, so there is nothing to send to.
            Make an address public on GitHub and sign in again.
          </p>
        )}
      </section>

      <section className="card p-6">
        <h2 className="eyebrow mb-4">Your activity</h2>
        <dl className="space-y-2 text-sm">
          <Row label="Builds published" value={String(summary.projectCount)} />
          <Row label="Challenges entered" value={String(summary.challengeCount)} />
          <Row label="Challenges won" value={String(summary.winCount)} />
        </dl>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/savings" className="btn-ghost">Your savings</Link>
          <Link href="/notifications" className="btn-ghost">Notifications</Link>
          <Link href="/submit" className="btn-ghost">Publish a build</Link>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[var(--color-faint)]">{label}</dt>
      <dd className="truncate text-right text-[var(--color-fg)]">{value}</dd>
    </div>
  );
}
