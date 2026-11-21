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

## Optional
| Variable | Turns on |
|---|---|
| `SEMAPHORE_API_KEY`, `SEMAPHORE_SENDER` | Real SMS (Philippines) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Real email |
| `MESSENGER_PAGE_TOKEN` | Facebook Messenger via your Page |
| `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` | Real GCash / Maya / card payments |
| `CRON_SECRET` | Daily automations (scheduled updates, maintenance work orders, dues reminder) |

Without these, messages are logged in Resident updates instead of sent, and payments run in test mode.

## Going live with real owners
Remove `DEMO_MODE`, set `NEXTAUTH_SECRET`, create real users in Admin → Users & units, and use a fresh database.
