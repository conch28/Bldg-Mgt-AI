import crypto from "crypto";
import { prisma } from "./db";
import { authSecret, demoMode } from "./env";
import { sendEmail, sendSms, channelStatus } from "./notify";
import { captureError } from "./monitor";

/** PH mobile numbers: 0917 123 4567 / 917... / +63 917... → +639171234567. Returns null if it is not a PH mobile number. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+63")) d = d.slice(3); else if (d.startsWith("63") && d.length === 12) d = d.slice(2); else if (d.startsWith("0")) d = d.slice(1);
  return /^9\d{9}$/.test(d) ? "+63" + d : null;
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const hash = (code: string, userId: string) => crypto.createHmac("sha256", authSecret()).update(`${userId}:${code}`).digest("hex");
export const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export async function findUserByIdentifier(identifier: string) {
  const id = identifier.trim();
  if (isEmail(id)) return prisma.user.findUnique({ where: { email: id.toLowerCase() } });
  const phone = normalizePhone(id);
  if (!phone) return null;
  // Phones may have been stored in other formats before import; compare on the last 10 digits.
  const last10 = phone.slice(-10);
  const candidates = await prisma.user.findMany({ where: { phone: { contains: last10.slice(-7) }, active: true } });
  return candidates.find((u) => normalizePhone(u.phone)?.slice(-10) === last10) ?? null;
}

/** Can a code actually reach this kind of identifier? */
export function canDeliver(identifier: string): boolean {
  const ch = channelStatus();
  return demoMode() || (isEmail(identifier) ? ch.EMAIL : ch.SMS);
}

/**
 * Creates and sends a 6-digit code. Always resolves the same way whether or not the account exists,
 * so the form cannot be used to find out who lives in the building.
 * In demo mode, when the channel is not connected, the code is returned so it can be shown on screen.
 */
export async function issueCode(identifier: string): Promise<{ demoCode?: string }> {
  const user = await findUserByIdentifier(identifier);
  if (!user || !user.active) return {};
  const channel = isEmail(identifier) ? "EMAIL" : "SMS";
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.loginCode.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }); // one live code at a time
  await prisma.loginCode.create({ data: { userId: user.id, channel, codeHash: hash(code, user.id), expiresAt: new Date(Date.now() + CODE_MINUTES * 60000) } });
  const text = `Your Skyland Plaza sign-in code is ${code}. It expires in ${CODE_MINUTES} minutes. Never share this code, even with building staff.`;
  const r = channel === "EMAIL" ? await sendEmail(user.email, `Your sign-in code: ${code}`, text) : await sendSms(user.phone, text);
  if (r.status === "FAILED") await captureError(new Error(`Sign-in code not delivered (${channel}): ${r.info}`), { source: "notify", userId: user.id });
  if (r.status !== "SENT" && demoMode()) return { demoCode: code };
  return {};
}

/** Checks a code; returns the user when it matches. Wrong guesses count against the code. */
export async function verifyCode(identifier: string, code: string) {
  const user = await findUserByIdentifier(identifier);
  if (!user || !user.active || !/^\d{6}$/.test(code)) return null;
  const lc = await prisma.loginCode.findFirst({ where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!lc || lc.attempts >= MAX_ATTEMPTS) return null;
  const ok = crypto.timingSafeEqual(Buffer.from(lc.codeHash), Buffer.from(hash(code, user.id)));
  await prisma.loginCode.update({ where: { id: lc.id }, data: ok ? { usedAt: new Date() } : { attempts: { increment: 1 } } });
  return ok ? user : null;
}

export const pruneCodes = () => prisma.loginCode.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 86400000) } } });
