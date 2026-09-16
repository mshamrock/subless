import Link from "next/link";
import type { Metadata } from "next";
import { BRAND, PIPELINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: "How it works",
  description: BRAND.sentence,
};

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-14">
      <header>
        <p className="eyebrow mb-3">{BRAND.mechanism}</p>
        <h1 className="text-4xl font-bold tracking-tight">How Subless works</h1>
        <p className="mt-4 text-lg leading-relaxed text-[var(--color-muted)]">
          Subscription fatigue is not one expensive tool. It is dozens of small recurring
          payments. Ten or fifteen dollars looks harmless until the stack is hundreds or
          thousands a year, and you are left asking the obvious question:
        </p>
        <p className="mt-4 text-xl font-semibold text-[var(--color-acid)]">
          Why am I paying every month for something this simple?
        </p>
      </header>

      <section>
        <h2 className="eyebrow mb-5">The Subless model</h2>
        <ol className="space-y-3">
          {PIPELINE.map((step) => (
            <li key={step.n} className="card flex gap-4 p-5">
              <span className="mono shrink-0 text-lg font-bold text-[var(--color-acid-dim)]">
                {step.n}
              </span>
              <div>
                <h3 className="font-semibold">{step.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">What makes this different</h2>
        <p className="mt-3 leading-relaxed text-[var(--color-muted)]">
          Most discovery products begin after software exists. Directories ask what
          alternatives are already out there. Launch platforms ask what shipped. Code hosts
          ask what developers built. Subless asks a different question:{" "}
          <span className="text-[var(--color-fg)]">what should exist?</span> The community
          validates demand first, and only then does anyone build.
        </p>
      </section>

      <section>
        <h2 className="eyebrow mb-5">The weekly challenge</h2>
        <div className="card p-6">
          <p className="leading-relaxed text-[var(--color-muted)]">
            Challenges are the heartbeat. Each one runs three weeks, but the phases overlap,
            so something happens every single week: a new challenge opens while the previous
            one is being voted on, and the week after that its winner sits on the homepage.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[var(--color-muted)]">
            <li>
              <span className="text-[var(--color-fg)]">Week 1 — Build.</span> Public must-have
              requirements, open to anyone. Seven days.
            </li>
            <li>
              <span className="text-[var(--color-fg)]">Week 2 — Vote.</span> One vote per
              person, movable, never for your own entry.
            </li>
            <li>
              <span className="text-[var(--color-fg)]">Week 3 — Launch.</span> The winner takes
              the homepage and its traffic.
            </li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)]">
            When the queue of challenges runs dry, the most-voted nomination becomes the next
            one automatically. The backlog belongs to the community, not to one person.
          </p>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">Free, and staying that way</h2>
        <p className="mt-3 leading-relaxed text-[var(--color-muted)]">
          Nothing here costs money: not the community, not voting, not nominating, not joining
          a build, not using what the community makes. It would be strange to fight
          subscriptions by selling another subscription.
        </p>
        <p className="mt-3 leading-relaxed text-[var(--color-muted)]">
          Later funding comes from disclosed partnerships — AI coding tools, hosting, APIs —
          who can support builds with credits and prizes. Partners can support builds. They
          cannot buy community votes, and any sponsorship is labelled where you see it.
        </p>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">How rankings stay honest</h2>
        <p className="mt-3 leading-relaxed text-[var(--color-muted)]">
          Half of quickly-built projects are dead a month after launch, so liveness multiplies
          the entire score rather than adding to it: a project with a thousand stars and its
          last commit a year ago sits below a living one with two hundred. Every project page
          spells out the formula term by term — a ranking you cannot look inside is not worth
          trusting.
        </p>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[var(--color-muted)]">
          <li>— GitHub sign-in only, and voting needs an account older than 30 days.</li>
          <li>— One vote per person per challenge, never for your own entry.</li>
          <li>— Repository ownership is verified through the GitHub API on submission.</li>
          <li>— Submissions and nominations both pass through moderation.</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/wanted" className="btn-primary">Nominate a subscription</Link>
        <Link href="/submit" className="btn-ghost">Publish a build</Link>
        <Link href="/challenges" className="btn-ghost">See the current challenge</Link>
      </div>
    </div>
  );
}
