# Notes for Claude Code

- Next.js 14 App Router + Prisma/Postgres + NextAuth credentials. TypeScript strict.
- Check work with `npm run typecheck` and `npm run build`. Local DB: `npx prisma migrate dev`, then `npm run db:seed`.
- Roles: OWNER, BOARD, MANAGER, ADMIN. Guard every page and server action with `requireRole(...)` from `lib/auth.ts`; middleware is a second layer, not the only one.
- Write an `audit(...)` entry for every change to money, tickets, users or reports.
- Money is PHP, stored as Decimal; format with `peso()` from `lib/format.ts`. Times display in Asia/Manila.
- Claude calls live in `lib/ai.ts` (Messages API, manual tool loop, default model `claude-opus-5-5`). Every AI feature must keep a no-key fallback.
- Owner-facing copy is English with natural Taglish where it fits. Keep it polite ("po").
- Do not mention FPD Asia or any current manager in the product or demo data.
