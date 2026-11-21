/**
 * Resolves settings so a Vercel + Supabase deploy works with no copy-pasting:
 * the Supabase integration sets POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING (possibly with a custom prefix),
 * and DEMO_MODE=1 turns on demo logins and test payments. Edge-safe (no Node APIs).
 */
const pick = (suffixes: string[]) => {
  for (const s of suffixes) {
    if (process.env[s]) return process.env[s];
    const k = Object.keys(process.env).find((x) => x.endsWith("_" + s) && process.env[x]);
    if (k) return process.env[k];
  }
  return undefined;
};
export const databaseUrl = () => process.env.DATABASE_URL || pick(["POSTGRES_PRISMA_URL", "POSTGRES_URL"]);
export const directUrl = () => process.env.DIRECT_URL || pick(["POSTGRES_URL_NON_POOLING"]) || databaseUrl();
export const authSecret = () => process.env.NEXTAUTH_SECRET || (pick(["POSTGRES_PASSWORD"]) ?? directUrl() ?? "") + ":skyland-session";
export const demoMode = () => process.env.DEMO_MODE === "1" || process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === "1";
