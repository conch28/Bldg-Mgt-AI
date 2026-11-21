# Deploying to Vercel + Supabase

About 20 minutes. You need: a GitHub account with this code in a repo, a Supabase account, a Vercel account, and (optional) an Anthropic API key.

## 1. Database (Supabase)

1. Create a project at supabase.com. Region: **Southeast Asia (Singapore)**. Save the database password.
2. Open **Project Settings → Database → Connection string → URI**.
   - **Transaction pooler** (port 6543) → this is `DATABASE_URL`. Append `?pgbouncer=true&connection_limit=1`.
   - **Direct connection** / session (port 5432) → this is `DIRECT_URL`.

## 2. App (Vercel)

1. vercel.com → **Add New → Project** → import the GitHub repo. Framework is detected as Next.js.
2. **Build command**: `npm run vercel-build` (generates Prisma, applies migrations, builds).
3. **Environment variables** (Settings → Environment Variables):

| Name | Value |
|---|---|
| `DATABASE_URL` | pooled URL from step 1 |
| `DIRECT_URL` | direct URL from step 1 |
| `NEXTAUTH_SECRET` | output of `openssl rand -base64 32` |
| `NEXTAUTH_URL` | your Vercel URL, e.g. `https://building-mgt-ai.vercel.app` |
| `ANTHROPIC_API_KEY` | from console.anthropic.com (optional) |
| `NEXT_PUBLIC_SHOW_DEMO_LOGINS` | `1` for a demo deployment only |
| `ALLOW_TEST_PAYMENTS` | `1` for a demo deployment only |

4. Deploy.

## 3. Load the Skyland demo data (demo deployments only)

From your computer, with the repo cloned:

```bash
npm install
DATABASE_URL="<direct URL>" DIRECT_URL="<direct URL>" npm run db:seed
```

Then sign in at your Vercel URL with `president@skyland.test` / `Skyland2026!`.

## 4. Payments (when ready to take real money)

1. Create a PayMongo account and complete business verification (the condominium corporation or the management company).
2. Developers → API keys → copy the **secret key** to `PAYMONGO_SECRET_KEY`.
3. Developers → Webhooks → add `https://<your-domain>/api/paymongo/webhook` for the event `checkout_session.payment.paid`. Copy the webhook secret to `PAYMONGO_WEBHOOK_SECRET`.
4. Remove `ALLOW_TEST_PAYMENTS`. Redeploy.

## 5. SMS reminders (optional)

Create a Semaphore account, register a sender name, set `SEMAPHORE_API_KEY` and `SEMAPHORE_SENDER`. Owners need a mobile number on their account.

## 6. Custom domain

Vercel → Settings → Domains → add e.g. `skyland.buildingmgt.ai`, then update `NEXTAUTH_URL`.

## Going live checklist

- [ ] `NEXT_PUBLIC_SHOW_DEMO_LOGINS` and `ALLOW_TEST_PAYMENTS` removed
- [ ] Production database has real units and owners, not seed data
- [ ] Admin account created with a strong password; seeded accounts removed
- [ ] PayMongo live keys and webhook set; one ₱20 test payment made end to end
- [ ] Privacy notice reviewed by the association's DPO
- [ ] Supabase daily backups confirmed (Pro plan has point-in-time recovery)
