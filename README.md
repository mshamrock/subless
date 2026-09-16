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

## Moderation

`/admin` manages both nominations and alternatives from one searchable list —
searchable because there are well over a hundred nominations, and a screen that
renders all of them is impossible to scan.

**Hide is not reject.** Rejecting says "this does not belong here"; hiding says
"not right now" — a broken build, a dead link, a repository gone private.
Collapsing the two loses the reason, and the reason is what a moderator needs
when they return to it a month later. Both drop out of every public query; only
`approved` is ever listed.

Deleting a build says out loud what goes with it — comments, challenge entries,
upvotes, recorded switches — because a hard delete takes community work with it
and hiding is almost always enough. Counting first costs a round trip and buys
back the chance to change your mind while the data still exists.

Admins can also add either directly. An admin-added nomination still starts at
**zero votes**: an admin putting a candidate on the board is not demand either.

## What the repository says

Every project page carries five things read from GitHub, chosen to answer one
question — *can I stop paying for the thing this replaces?*

**Self-hosting readiness.** Dockerfile, compose file, Helm chart, `.env` example,
and one-click deploy targets found in the README. A repository with
`docker compose up` and one that needs three services wired by hand are different
products to someone cancelling a subscription, and no other catalog shows the
difference.

**A year of commit activity.** A sparkline, because the score's liveness
multiplier should be visible rather than asserted: one commit yesterday on a dead
project and a steady year are identical as a date and obviously different as a
shape.

**Latest release.** Tag, date and downloadable assets — is it still shipping, and
do I build it or just download it?

**Who maintains it.** Contributors with the busiest one's share of commits.
"801 contributors" hides the case where one person wrote nearly all of it, which
is the risk that matters when you are about to depend on this instead of a paid
product. Above 80% the page says so out loud. Bots are excluded: Dependabot can
out-commit every human in a busy repository, which would skew the number in the
reassuring direction — the wrong way for a risk signal to be wrong.

**Good first issues.** The one block not about deciding. It is about joining in.

Each piece degrades on its own: no releases, no README, or statistics GitHub has
not finished computing still leaves the rest. Insights are fetched in a
best-effort pass after the metrics, so a failure there never marks a project
unsynced — the numbers people rank by are already saved.

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

`/alternatives` is the hub those pages hang off. Before it existed the only
internal links to a service page were a handful of chips on `/catalog`, so most
of them appeared in the sitemap and nowhere else — and a page nothing links to is
one search engines treat as unimportant and people cannot browse to. It is not
`/catalog` renamed: the catalog lists the builds, this lists the subscriptions,
and a service with nothing built for it is still shown, as demand. Which is the
thing a directory has no way to express.

## The feed

`/feed.xml` is the weekly heartbeat for anyone who will not make an account.
A newsletter or aggregator takes a feed; it does not take a sign-up, and the
digest only reaches people who already signed in — so this is the one channel
that costs nothing to run and nothing for the other side to adopt.

Items are **moments, not challenges**. A challenge lives three weeks and changes
twice while it does, so one item per challenge would announce it once and then
silently rewrite itself: a subscriber would never hear that voting opened or that
a winner launched. Three items with stable guids (`#building`, `#voting`,
`#finished`) reproduce what the cycle actually promises — two things every week,
and a reader sees both.

Each moment is gated on the status as well as the clock. The tick runs weekly, so
a date passing is not the same as the phase having turned, and announcing voting
on a challenge still in build week would be a lie told automatically.

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

## Testing

Step 4 of the model. Under every challenge entry, anyone signed in can work
through the challenge's own requirement list and mark what the build actually
does, with a note for what broke.

Testing against **the list the community already agreed on** is what turns "I
liked it" into something a voter can act on. A build showing *3/5 verified* next
to one showing *5/5* is a different decision from two builds with four stars each.

Coverage is shown per requirement rather than as a single number, because which
requirement is failing matters more than the average of all of them. A
requirement nobody has tested reads as zero coverage with zero testers — honestly
different from tested and failing.

Each answer stores the **requirement text**, not an index into the challenge.
Requirements get edited; an index quietly starts pointing at a different line and
every past report becomes a lie about what was checked.

Testing stays open after voting closes: the brief's order is Build → Test → Use,
and the person adopting a launched winner is exactly the one whose report is
worth having. Testing your own entry is blocked, for the same reason voting for
it is.

This is where **Community rating** on a project page comes from: the share of
required features testers found working, averaged across every challenge it
entered. Grounded in checklists rather than a star widget — stars tell you people
liked it, this tells you which promises it keeps.

## Not built yet

- **Outbound email beyond three messages.** No digest preferences, no per-event
  opt-out — it is on or off.
- **Editing.** A submitted build or nomination cannot be corrected by its author;
  only an admin can hide or delete it.
- **Rate limiting.** Nothing throttles comments, nominations or submissions. Fine
  while it is quiet; the first time it is not, this is what breaks.

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
