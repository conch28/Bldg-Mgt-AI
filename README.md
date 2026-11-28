# Building Mgt AI

AI-first building management for Philippine condominiums. This first version runs one building, **Skyland Plaza** (two towers, 172 units; layout in `lib/skyland.ts`), and ships with realistic sample data so it can be demoed on day one.

## What's in it

| Who | Screens |
|---|---|
| **Owners** | My unit (balance, pay online, tickets, rate repairs, bookings) · Helpdesk chat (Claude, English/Tagalog/Taglish; files tickets, checks balances, books services, escalates to a person) · Services booking |
| **Board** | Today at Skyland (briefing, KPIs, activity) · Finances (budget vs actual, income vs spending, AI monthly report, dues-increase planner) · Manager scorecard (computed from live data) · read-only Work orders and Collections |
| **Property manager** | Work orders (status, assignee, live SLA timers, every change logged) · Collections (overdue accounts, AI-drafted reminders, SMS send, record payments) · Generate the board report |
| **Admin** | Users & units (create accounts, link owners to units, disable; people sign in with a one-time code) · Integration status · Audit log |

**Data-entry accountability** (`lib/duties.ts`): every record has one owner, a deadline, a checker and an escalation path. Staff and board see **My tasks** (`/tasks`, overdue first, with a front-desk form to log walk-ins and calls); the board sees **Accountability** (`/duties`: the matrix plus on-time scores per role). Technicians close jobs from a one-tap **job link** (`/j/<token>`, no login) with a required after photo; the manager verifies within 24h. Money gates: no receipt, no payment; payment is released by someone other than the requester, never above the PO, and only after a linked repair is verified. Overdue records remind the owner, then their supervisor, then the board (daily cron and whenever a manager opens My tasks). Deadlines live in `DUTIES` and are the "Standard" set: ack tickets 1h by day / 4h at night, receipts within 24h, rounds by end of shift, board report by the 5th.

**Staff data scores** (`/integrity`, `lib/staffscore.ts`, `lib/integrity.ts`): a per-person score over 30 days on four pillars (on time, complete, accurate, verified) for guards, technicians/vendors and managers, with the exact entries that lowered it and a coaching tip. Staff see their own score on My tasks; technicians see theirs on the job link. Pay link is **bonus only**: 90%+ with no confirmed serious flag earns the monthly data bonus; nothing is deducted (vendors: counts toward renewal). **Spot checks**: each Monday the app randomly draws 10% of finished repairs (3 to 6), 2 guard rounds and 1 receipt for the manager to re-check by Sunday; no one checks their own entry. **Entry flags** (daily cron or "Run checks now"): identical or near-identical proof photos (SHA-256 + 64-bit dHash via `jpeg-js`, with an optional Claude vision second opinion), an after photo matching the resident's problem photo, the same note pasted on different kinds of jobs, 3+ jobs in different places marked done within 15 minutes, 4+ front-desk complaints logged within 10 minutes, and rounds entered in under 15 minutes. Flags are prompts, not proof: staff can add their side, a manager (never the person flagged) clears or confirms with a coaching note, and only confirmed flags count.

**Data Center** (`/data`, `lib/readiness.ts`, `lib/datachecks.ts`): is the information the building runs on complete, verified and current? A readiness register of 31 requirements (source, owner, freshness, verification, live status, board sign-off), a score weighted by criticality with a separate safety gate, and 18 daily checks that open P0–P3 issues and tell the owner. Assets & QR (`/data/assets`): make, model, serial, criticality, spec verification by a second person, manuals, schedules with interval sources, printable QR labels that open the asset page (guards can report faults), CSV import with check, preview and undo. Permits & insurance (`/data/compliance`) and Contractor vetting (`/data/contractors`) with maker-checker verification. Governance docs in `docs/data-governance/`; onboarding templates in `templates/data-collection/` (generated from `lib/templates.ts`).

Everything is stored in Postgres. Every login, payment, ticket change, reminder and report is written to the audit log.

## Stack

Next.js 14 (App Router, server actions) · Prisma + Postgres (Supabase in production) · NextAuth (one-tap demo sign-in or one-time codes, JWT sessions) · Anthropic SDK (`claude-opus-5-5` by default) · PayMongo Checkout (GCash, Maya, cards) · Semaphore SMS.

Each integration is optional. Without a key, the app falls back gracefully:

| Env var | With it | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude runs the owner chat (with tools against the database), writes board reports and reminders | Keyword-based replies that still read and write real data; template reports and reminders |
| `PAYMONGO_SECRET_KEY` + `PAYMONGO_WEBHOOK_SECRET` | Real GCash/Maya/card checkout; webhook marks bills paid | "Pay" is hidden in production, or simulated if `ALLOW_TEST_PAYMENTS=1` |
| `SEMAPHORE_API_KEY` | Reminders go out by SMS | Reminders are logged only |

## Run it locally

Needs Node 20+ and Postgres 14+.

```bash
cp .env.example .env          # fill DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET
npm install
npx prisma migrate deploy     # create tables
npm run db:seed               # load Skyland sample data
npm run db:legal              # load the legal library and template house rules for Ask AI
npm run dev                   # http://localhost:3000
```

Seeded logins (no passwords: on the demo site, tap a role on the sign-in page):

| Role | Email |
|---|---|
| Owner, unit 1202B | owner@skyland.test |
| Board president / treasurer | president@skyland.test / treasurer@skyland.test |
| Property manager | manager@skyland.test |
| Admin | admin@skyland.test |

Set `NEXT_PUBLIC_SHOW_DEMO_LOGINS=1` to show one-click demo logins on the sign-in page.

## Deploy

See [DEPLOY.md](DEPLOY.md) for Vercel + Supabase, step by step.

## Project layout

```
app/(app)/            signed-in screens: board, finances, scorecard, work-orders, collections, my, chat, services, admin, account
app/api/chat          owner chat endpoint (rate-limited)
app/api/paymongo      payment webhook (signature-verified)
lib/ai.ts             Claude: helpdesk tool loop, board report, reminders (+ fallbacks)
lib/metrics.ts        collection rate, aging, SLA, budget queries
lib/auth.ts           NextAuth config, requireRole(), audit()
middleware.ts         route protection by role
prisma/schema.prisma  data model
prisma/seed.ts        Skyland sample data (refuses to run in production unless SEED_ALLOW_PRODUCTION=1)
```

## Before real residents use it

- Turn off `NEXT_PUBLIC_SHOW_DEMO_LOGINS` and `ALLOW_TEST_PAYMENTS`.
- Don't seed production with sample data. Create the building and accounts with real data (an import script for the unit/owner list is the next thing to build).
- Don't create seed accounts in production.
- Have the association's Data Protection Officer review the privacy notice (Data Privacy Act, RA 10173). Owner names, units, phones and balances are personal data.
- Budget lines are entered by seed only today; a bookkeeping import (or Xero/QuickBooks sync) is next.
- The app assumes one building per deployment. Most queries don't filter by building yet.
