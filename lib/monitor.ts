import { prisma } from "./db";

/**
 * Error monitoring. Every error is stored in ErrorLog (shown under Admin → System health).
 * If SENTRY_DSN is set, it is also sent to Sentry through its HTTP store API (no SDK needed).
 * Personal data is not sent: messages are trimmed and emails / phone numbers are masked.
 */
export const mask = (s: string) => s
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
  .replace(/(\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}/g, "[phone]");

export async function captureError(err: unknown, ctx: { source?: string; path?: string; userId?: string | null; extra?: string } = {}) {
  const e = err instanceof Error ? err : new Error(String(err));
  const message = mask(e.message || "Unknown error").slice(0, 500);
  const detail = mask([ctx.extra, e.stack].filter(Boolean).join("\n")).slice(0, 4000);
  console.error(`[${ctx.source ?? "server"}]`, ctx.path ?? "", e);
  try {
    await prisma.errorLog.create({ data: { source: ctx.source ?? "server", message, detail, path: ctx.path?.slice(0, 300), userId: ctx.userId ?? null } });
  } catch { /* the database may be the thing that failed */ }
  await sendToSentry(message, detail, ctx).catch(() => {});
}

async function sendToSentry(message: string, detail: string, ctx: { source?: string; path?: string; userId?: string | null }) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const u = new URL(dsn); // https://<key>@oXXXX.ingest.sentry.io/<project>
  const project = u.pathname.replace(/\//g, "");
  const url = `${u.protocol}//${u.host}/api/${project}/store/?sentry_version=7&sentry_key=${u.username}`;
  await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message, level: "error", platform: "node", environment: process.env.DEMO_MODE !== "0" ? "demo" : "production",
      tags: { source: ctx.source ?? "server", path: ctx.path ?? "" }, user: ctx.userId ? { id: ctx.userId } : undefined, extra: { detail },
    }),
    signal: AbortSignal.timeout(3000),
  });
}

export const pruneErrors = () => prisma.errorLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86400000) } } });
