# Deploy (Vercel + Supabase)

1. Vercel → Add New → Project → import this repo.
2. Environment variables:
   - `ANTHROPIC_API_KEY` — from console.anthropic.com (AI helpdesk, drafts, reports, feedback topics)
   - `DEMO_MODE` = `1` — demo logins on the sign-in page, test payments, and Skyland sample data loaded into an empty database
3. Deploy. (The first build works without a database.)
4. Storage → Create Database → Supabase (region Singapore) → Connect to the project.
5. Deployments → ⋯ → Redeploy. `scripts/vercel-build.mjs` finds the Supabase variables
   (`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`), runs migrations, and seeds only if the database is empty.

No `NEXTAUTH_SECRET` or `NEXTAUTH_URL` is needed on Vercel: the session secret is derived from the database
password, and the URL comes from Vercel. Set `NEXTAUTH_SECRET` yourself for a real launch.

## Current deployment
Demo: https://bldg-mgt-ai.vercel.app (Vercel Hobby, region sin1) with Supabase `supabase-almond-engine` (Singapore, free plan).

## Optional
| Variable | Turns on |
|---|---|
| `SEMAPHORE_API_KEY`, `SEMAPHORE_SENDER` | Real SMS (Philippines) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Real email |
| `MESSENGER_PAGE_TOKEN` | Facebook Messenger via your Page |
| `FB_PAGE_ID`, `FB_PAGE_TOKEN` | Auto-post unit listings to your Facebook Page (Marketplace and groups go to the leasing team with the AI post kit; Facebook has no posting API for them) |
| `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` | Real GCash / Maya / card payments |
| `CRON_SECRET` | Daily automations (scheduled updates, maintenance work orders, dues reminder) and data clean-up (old sign-in codes, error logs) |
| `SENTRY_DSN` | Error alerts by email from Sentry (errors are always kept in Admin → System & privacy too) |
| `DPO_NAME`, `DPO_EMAIL`, `COMPANY_NAME` | Privacy officer shown in the privacy notice |

Without these, messages are logged in Resident updates instead of sent, and payments run in test mode.

## Going live with real owners (production mode)
Keep the demo as it is. Make a **second** Vercel project from the same repo, so the demo link keeps working.

1. Vercel → Add New → Project → import `Bldg-Mgt-AI` again, name it e.g. `skyland-app`. Region stays `sin1` (vercel.json).
2. Storage → Create Database → Supabase (Singapore) → connect to Production. Use a new database, never the demo one.
3. Environment variables (do **not** set `DEMO_MODE`):
   - `NEXTAUTH_SECRET`: a long random string (`openssl rand -base64 32`)
   - `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_MOBILE`: the first admin login, created on deploy
   - `BUILDING_NAME`, `BUILDING_CITY`, `DUES_RATE` (₱ per sqm per month)
   - At least one way to send sign-in codes: `RESEND_API_KEY` + `EMAIL_FROM` and/or `SEMAPHORE_API_KEY` + `SEMAPHORE_SENDER`
   - Then the optional keys above as accounts come in.
4. Deploy. The build creates the building and admin (prisma/bootstrap.ts). No sample data.
5. Sign in as the admin with a one-time code, accept the privacy notice, then Admin → **Import data**: download the template, fill one row per unit, check, import.
6. Settings → Domains → add the custom domain (e.g. `app.yourbrand.ph`), add the DNS record Vercel shows.

How production differs from the demo: one-tap role buttons, on-screen codes, "simulate" buttons and test payments are off; people sign in with a 6-digit code by email or SMS (no passwords); everyone accepts the privacy notice on first sign-in.

## Backups
Supabase free has no downloadable backups, so `.github/workflows/backup.yml` makes one every night at 2 AM Manila, encrypted with AES-256, kept 30 days as a GitHub Actions artifact. Add two repository secrets: `DATABASE_BACKUP_URL` (the production `POSTGRES_URL_NON_POOLING`) and `BACKUP_PASSPHRASE` (keep it in a password manager). Restore steps are in the workflow file. On Supabase Pro, daily backups and point-in-time recovery are built in as well.

## Monitoring
- Admin → System & privacy: connection status, last 20 errors, privacy requests.
- `SENTRY_DSN` for email alerts (free plan is enough). Names, emails and phone numbers are masked before sending.
- Uptime: point a free monitor (UptimeRobot, Better Stack) at `https://<domain>/api/health` every 5 minutes.

## Rate limits (stored in Postgres, so they hold across serverless instances)
Sign-in codes: 5 requests per address per 15 min, 10 code checks; per-IP caps on both. Chat: 12 per minute, 150 per day. AI drafts: 40 per hour. New listings: 10 per hour. Data export: 5 per hour.
