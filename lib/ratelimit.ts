import { headers } from "next/headers";
import { prisma } from "./db";

/**
 * Fixed-window rate limit stored in Postgres, so it holds across Vercel's serverless instances.
 * Returns ok=false once `limit` hits happen inside `windowSec` for the same key.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; retryAfterSec: number }> {
  try {
    const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}))
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"`;
    const r = rows[0];
    const retryAfterSec = Math.max(1, Math.ceil((new Date(r.resetAt).getTime() - Date.now()) / 1000));
    return { ok: Number(r.count) <= limit, retryAfterSec };
  } catch (e) {
    console.error("rate limit error", e);
    return { ok: true, retryAfterSec: 0 }; // never lock people out because the limiter itself failed
  }
}

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(h?: Headers | Record<string, any>): string {
  const get = (k: string) => (h ? (typeof (h as Headers).get === "function" ? (h as Headers).get(k) : (h as any)[k]) : (() => { try { return headers().get(k); } catch { return null; } })());
  const xff = get("x-forwarded-for");
  return (xff ? String(xff).split(",")[0].trim() : get("x-real-ip")) || "unknown";
}

export const tooMany = (sec: number) => `Too many tries. Please wait ${sec > 90 ? Math.ceil(sec / 60) + " minutes" : sec + " seconds"} and try again.`;

/** Clears old windows; called from the daily cron. */
export const pruneRateLimits = () => prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 86400000) } } });
