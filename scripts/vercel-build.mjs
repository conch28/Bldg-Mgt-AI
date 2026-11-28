// Build step for Vercel: finds the Supabase database settings, applies migrations,
// loads the Skyland demo data (only into empty tables) unless DEMO_MODE=0, otherwise creates the
// building and first admin (prisma/bootstrap.ts), then builds Next.js.
import { execSync } from "node:child_process";

const env = { ...process.env };
const find = (names) => {
  for (const n of names) {
    if (env[n]) return env[n];
    const k = Object.keys(env).find((x) => x.endsWith("_" + n) && env[x]);
    if (k) return env[k];
  }
};
env.DATABASE_URL ||= find(["POSTGRES_PRISMA_URL", "POSTGRES_URL"]);
env.DIRECT_URL ||= find(["POSTGRES_URL_NON_POOLING"]) || env.DATABASE_URL;
const run = (cmd) => { console.log("\n$ " + cmd); execSync(cmd, { stdio: "inherit", env }); };

run("npx prisma generate");
if (!env.DATABASE_URL) {
  console.warn("\n⚠ No database connected yet. Building without migrations.\n  In Vercel: Storage → Create Database → Supabase → Connect, then Redeploy.\n");
} else {
  run("npx prisma migrate deploy");
  run("npx tsx prisma/legal-sync.ts"); // legal library + template house rules for Ask AI
  if (env.DEMO_MODE !== "0") { env.SEED_ALLOW_PRODUCTION = "1"; env.SEED_IF_EMPTY = "1"; run("npx tsx prisma/seed.ts"); }
  else run("npx tsx prisma/bootstrap.ts"); // production: building + first admin only, never sample data
}
run("npx next build");
