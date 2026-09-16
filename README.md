# Subless

**Stop renting software. Build free alternatives together.** · [gosubless.com](https://gosubless.com)

Subless is a free community where people vote for the software subscriptions they
want replaced, and builders create free alternatives together.

Most discovery products begin *after* software exists — directories ask what
alternatives are out there, launch platforms ask what shipped, code hosts ask what
developers built. Subless asks what *should* exist. The community validates demand
first and builds second, so the catalog is a by-product of the challenges rather
than the point of the product.

**Demand first. Build second.**

This distinction drives the information architecture: `/wanted` (demand) leads the
navigation, `/challenges` is the heartbeat, and `/catalog` is what the challenges
leave behind. The brand brief is explicit that Subless is *not* a directory of
existing alternatives, so the site must not read like one.

## The weekly challenge

A challenge runs three weeks, but the phases overlap, so exactly two things happen
every week: a new contest opens, and the previous vote is settled.

| Week | Phase | What happens |
|------|-------|--------------|
| 1 | `building` | Admin announces the target service and required feature set. Entries open. |
| 2 | `voting` | Entries close. One vote per person; votes can be moved or withdrawn. |
| 3 | `finished` | The winner takes the homepage — and its traffic — for a full week. |

Each weekly tick shifts the whole pipeline one step (`finished → archived`,
`voting → finished`, `building → voting`, `queued → building`). If the queue is
empty, the most-voted approved nomination is promoted into a challenge
automatically, so the backlog is shaped by the community rather than one person.

The tick runs on a Vercel Cron schedule (`vercel.json`) and can also be triggered
manually from `/admin`. Every run is written to `cycle_log`.

## The North Star

The headline metric is **annual subscription cost the community has actually
stopped paying**, and it is literal: every dollar comes from a recorded switch,
not from a projection.

Pressing *I went Subless on X* writes a row to `switches` — one per person per
subscription. The annual price is **snapshotted at that moment** rather than
joined at read time, because a vendor repricing its plan must not silently
rewrite what somebody saved last year.

The homepage shows the real figure, with the catalog's unclaimed potential as a
secondary line so the two are never confused. `/savings` gives each person their
own total and a copyable summary to share.

Subscriptions are quoted **per year** everywhere. `$12/mo` reads as harmless;
`$144/year` reads as a decision.

Subscriptions are quoted **per year** everywhere. `$12/mo` reads as harmless;
`$144/year` reads as a decision.

## Ranking

Rank is a composite score, spelled out in full on every project page — a ranking
you cannot look inside is not worth trusting.

```
popularity = ln(stars) + 0.5·ln(forks) + 0.9·ln(contributors)
           + 0.4·ln(downloads) + 0.7·ln(upvotes) + 0.3·ln(clicks)
momentum   = 0.8·ln(stars gained this week)
liveness   = 0.3 + 0.7 · 0.5^(days since last commit / 60)

score = (popularity + momentum) × liveness × 10
```

Two deliberate choices:

- **Liveness multiplies, it does not add.** Half of vibe-coded projects are dead
  a month after launch, so an abandoned repo with 1000 stars should sit below a
  living one with 200. Archived repositories are treated as dead outright.
- **Click-throughs come from the Try button.** Every card with a live site gets
  one, and pressing it records a click-through. Nothing else increments that
  term, so it measures people actually going to look at the thing.
- **Downloads are not the headline metric.** GitHub only reports download counts
  for release assets, and most of these projects are web apps with no releases —
  that metric is silent for half the catalog, so it carries a small weight.

## Product icons

Every place a real paid service is named shows its icon. Those icons are fetched
**once, server-side**, stored as base64 on the target row, and served from
`/api/targets/<slug>/icon`.

The shortcut would be to point `<img>` at a favicon service and let each
visitor's browser fetch it. This catalog recommends Plausible and Umami for not
tracking people, so shipping a third-party request on every page view would
undercut its own premise. A few KB per service buys the consistency.

Icons are picked up automatically when a service first enters the catalog — a
project submission naming a new service, an admin creating a contest, or an
approved nomination. To backfill, either run `npm run db:logos` with the dev
server stopped (`--force` re-fetches everything after a rebrand), or press
**Fetch missing icons** in `/admin`, which runs the same code inside the server
process and so works while the server is up.

Services with no usable favicon fall back to a monogram tile coloured from the
name, so the layout never shifts and nothing renders as a broken image.

## Stack

Next.js 15 (App Router) · Postgres via Drizzle · Auth.js with GitHub · Tailwind v4.

Local development runs on **PGlite**, real Postgres compiled to WASM, stored in
`./.data/pg`. Production uses `postgres.js` against `DATABASE_URL`. The schema,
migrations and SQL are identical in both — no "SQLite locally, Postgres in prod"
drift. Switching is just the presence of `DATABASE_URL`.

## Getting started

```bash
npm install
npm run db:push     # apply migrations
npm run db:seed     # demo data: real services, real repos
npm run db:sync     # pull live GitHub metrics and repo homepages
npm run db:logos    # fetch product icons
npm run dev
```

Then copy `.env.example` to `.env.local` and fill in what you need.

### Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Empty for local PGlite; a Postgres URL in production. |
| `AUTH_SECRET` | Auth.js session secret. Generate with `openssl rand -base64 32`. |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth app. Callback: `<origin>/api/auth/callback/github`. |
| `ADMIN_LOGINS` | Comma-separated GitHub logins granted admin. Applied at sign-in, so sign out and back in after changing it. |
| `CRON_SECRET` | Shared secret guarding `/api/cron/*`. Vercel sends it as `Authorization: Bearer`. |
| `GITHUB_TOKEN` | Optional but strongly recommended — raises the API limit from 60/hour to 5000. |
| `RESEND_API_KEY` | Leave empty and no mail is sent; every message is logged instead. |
| `EMAIL_FROM` | Sender address, e.g. `Subless <noreply@gosubless.com>`. |

**On `GITHUB_TOKEN`:** each project costs up to three API calls, so without a
token a catalog of ~20 projects exhausts the hourly budget in a single sync. The
sync degrades gracefully when the budget runs low — it keeps fetching the core
repo record and drops the contributor and download lookups — but a token makes
the whole problem go away.

### PGlite is single-process

PGlite is file-backed with no cross-process locking. Running a CLI script while
`npm run dev` holds `./.data/pg` corrupts the database directory. The scripts
refuse to start when they detect a dev server on the port; to sync while the
server is up, use the **Sync metrics** button in `/admin`, which runs inside the
server process. This restriction does not exist in production, where
`DATABASE_URL` points at a real Postgres server.

## Two doors, named differently

The brief's pipeline uses "Submit" for nominating a *subscription*, not for
publishing your own work — that is step 3, Build. Conflating the two is the
easiest way to make the site read like a directory again, so the entry points are
deliberately separate:

| Door | Route | Who it is for |
|---|---|---|
| Nominate a subscription | `/wanted` | anyone paying for something they resent |
| Publish a build | `/submit` | someone who built an alternative |

`/submit` never opens on a blank form. It leads with this week's challenge and its
requirements, or the top of the demand queue, because the brief's entire pitch to
builders is that demand is validated before anyone writes code.

`/wanted` has search, and its empty state is the point rather than a dead end:
someone searching there is asking "is my subscription already nominated?", so a
miss pre-fills the nomination form with what they typed. If the query matches a
service that already has published alternatives, that is shown first — a working
alternative is a better answer than the chance to ask for one.

Publishing starts from **your own repository list**, not a URL field. Typing a
URL asks someone to fetch something they already have open in another tab; the
list fills in name, description and homepage from GitHub and removes the whole
class of typo and wrong-owner mistakes. Repositories already in the catalog are
shown greyed out rather than hidden, so it is obvious why one cannot be picked.
Every field stays editable, and the manual URL field still works.

`/submit?challenge=<slug>` publishes **and** enters the challenge in one step.
Arriving from a challenge page means the intent was to compete; making someone
publish, navigate back and submit again was a pointless extra step at exactly the
wrong moment.

## People

| Route | What it is |
|---|---|
| `/leaderboard` | builders, ranked |
| `/builders/[login]` | a public profile — builds, wins, badges, impact |
| `/settings` | your account and email preference |
| `/savings` | private: what you personally stopped paying for |

The leaderboard ranks **people, not projects** — a list of projects there just
repeated the catalog. Order follows the brand's own yardstick: money actually
cancelled through someone's builds, then challenge wins, then reach.

Its aggregates are three queries merged in memory rather than one wide join.
Joining switches, contests and project metrics in a single statement fans the
rows out and silently multiplies the sums; the builder count is small, and being
obviously correct is worth more here than two saved round trips.

Settings shows name, avatar and email as read-only. They come from GitHub, and
editable copies would invite people to change a name that silently resets on
their next sign-in.

## Discussion and notifications

Projects and contests carry comment threads. Threads are **one level deep** on
purpose: replying to a reply attaches to the same top-level comment, so a thread
can never become an unreadable staircase on a phone.

Deletes are soft — the row stays so replies underneath keep their place, and the
UI shows a tombstone. Authors delete their own comments; admins delete any.

Two things generate an in-app notification:

| Trigger | Who hears about it |
|---|---|
| Someone replies to your comment | the comment's author |
| Someone comments on a project you submitted | the project's submitter |

Nobody is ever notified of their own action. Notifications are in-app only — a
bell in the header with an unread count, and `/notifications`, where each entry
deep-links to the exact comment. There is no mail pipeline here, and a bell that
works beats an email integration that is half-built.

Notifications store the subject's title and slug at write time rather than
joining on read, so the list stays cheap and a later rename does not rewrite
history.

## Anti-abuse

- GitHub sign-in only, and voting requires an account older than 30 days.
- One vote per person per contest; no voting for your own entry.
- Repository push access is verified through the GitHub API on submission — a
  project without verified ownership still publishes, but earns no author badge.
- Projects and nominations both pass through moderation.
- Commenting requires a signed-in GitHub account; deletes are restricted to the
  comment's author and admins.

## Tests

```bash
npm test
```

Vitest against an **in-memory PGlite** database, migrated with the real SQL from
`drizzle/` — a hand-written test schema that has drifted from the migrations
tests nothing.

Coverage is deliberately narrow and aimed at the code where a bug is expensive:

- **The weekly tick.** It runs unattended on a cron, mutates state irreversibly,
  and a mistake costs the community a week of work in public. Tests cover each
  phase transition, the guard against a queued challenge skipping voting, winner
  selection, empty challenges, and nomination promotion.
- **The score.** It is published term by term on every project page, so the
  properties it claims — liveness multiplying rather than adding, one breakout
  not flattening the table, a failed sync not reading as abandonment — are
  asserted rather than asserted *about*.
- **Switches.** The arithmetic behind the site's single most visible number,
  including the price snapshot and one-switch-per-person-per-subscription.
- **Email.** That opted-out and address-less people resolve to nothing, that no
  key means no send, that author-supplied text cannot open a tag in an HTML
  message, and that every message carries an unsubscribe link in both bodies.

## Email

Three messages: a reply to your comment, a comment on your build, and the weekly
digest sent by the cron right after the tick — the product's only heartbeat
outside the site, since a weekly cadence is worthless if nobody is told the week
turned.

**Nothing is sent without `RESEND_API_KEY`.** Without a key every message is
logged to the server console instead, so a fresh clone never silently mails real
people while someone is testing, and the whole path is still exercised in
development. Set the key and mail goes out — including to everyone who has signed
in, so check the dry-run output before you add it.

Email is **opt-out**: someone who signed in to take part expects to hear that
voting opened. Every message carries a one-click unsubscribe that works from the
token alone, with no session — requiring a login to stop receiving mail is a dark
pattern, and the token grants nothing except turning its own emails off.

`resolveRecipient` returns null for anyone without an address or opted out, so
every caller fails closed: forgetting the check means no mail, never mail to
someone who asked not to get it.

Admins can trigger the digest from `/admin` to see it before a real week turns.

### Inbox placement

Messages are plain and light on purpose. Gmail's tab classifier reads design as
intent: a dark card with a large coloured call-to-action is the visual grammar of
marketing and gets filed under Promotions whatever the content says.

Only the **digest** sets `unsubscribeUrl`, which is what adds the RFC 8058
`List-Unsubscribe` headers. Those are required of bulk senders — and they also
tell Gmail "this is list mail", which is the right classification for a weekly
digest and the wrong one for a reply to your comment. Transactional messages keep
the unsubscribe link in the body instead, which is where people look for it.

Expect the digest to land in Promotions regardless. It *is* a newsletter, and
Gmail is not wrong about that; placement is driven far more by the recipient's
own history with the sender than by anything in the markup. Chasing it with
further template changes has sharply diminishing returns.

## Recognition

Badges follow §12: *"profiles should show impact rather than vanity activity."*
Every badge is earned by something that happened to **other people** — a build
adopted, a subscription cancelled, a challenge won. None can be earned by
activity alone, because a badge for showing up is worth nothing to the person
holding it and misleads everyone reading it.

Builder profiles lead with what people actually cancelled through their builds,
falling back to what those builds *could* replace when nobody has switched yet —
labelled as such, never conflated.

## Search

`/alternatives/*` is the organic entry point: people search "calendly
alternative". `sitemap.ts` lists every service — including ones with no build
yet, since those pages collect demand rather than traffic — plus builds and
challenges. `robots.ts` keeps `/admin`, `/savings`, `/notifications` and `/api`
out of the index.

Open Graph cards are generated per page from one shared template, using system
fonts rather than a font fetch: an OG route that reaches a CDN on every render is
a slow path that fails silently, and a missing preview is worse than a plain one.

## The candidate slate

`/wanted` ships with a starting slate of subscriptions worth replacing, loaded
from `/admin`. The curation filter is **feasibility, not popularity**: can
someone with Claude Code or Codex ship a version that genuinely replaces the paid
product's core in a week? Each entry carries a concrete note on what a usable
replacement needs, which becomes the challenge brief if it wins a vote.

Four categories are deliberately excluded, with the reason kept in
`src/lib/data/candidates.ts`: tools holding secrets, products whose value is a
proprietary dataset, infrastructure with a reputation moat, and network-effect
platforms. Saying no is the useful half of the list.

Candidates seed with **zero votes and no author**. A candidate says "here is
something to consider"; a seeded vote count would be fabricated demand, and
demand is the one thing this site cannot invent without undermining its own
headline number.

## Not built yet

- **The Test step.** The brief's pipeline is Submit → Vote → Build → **Test** →
  Use → Go Subless. Structured feedback against a challenge's requirement
  checklist does not exist; comments are the whole of it today.

## Deploying

Push to a Git repo and import it into Vercel, then:

1. Provision Postgres (Neon or Vercel Postgres) and set `DATABASE_URL`.
2. Set the remaining environment variables from the table above.
3. Run migrations against the production database:
   `DATABASE_URL=… npm run db:push`
4. `vercel.json` already registers both cron jobs: the weekly tick (Mondays
   09:00 UTC) and the daily metrics sync (04:00 UTC).

## Layout

```
src/lib/cycle.ts        the weekly pipeline: tick, tally, promote nominations
src/lib/score.ts        the composite score and its breakdown
src/lib/sync.ts         GitHub sync and score recomputation
src/lib/github.ts       GitHub REST client and ownership verification
src/lib/db/schema.ts    full schema
src/lib/actions/        server actions: submit, vote, nominate, moderate
src/app/                pages
src/lib/logos.ts        server-side icon fetching
src/lib/comments.ts     comment subject resolution
scripts/                migrate, seed, sync, logos, stats
```
