"use server";
import { z } from "zod";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { issueCode, isEmail, normalizePhone, canDeliver, CODE_MINUTES } from "@/lib/otp";
import { captureError } from "@/lib/monitor";

export type CodeState = { sent?: boolean; error?: string; to?: string; demoCode?: string; identifier?: string };

/** Step 1 of passwordless sign-in. The reply is the same whether or not the account exists. */
export async function requestCode(_: CodeState, fd: FormData): Promise<CodeState> {
  const raw = z.string().trim().max(120).safeParse(fd.get("identifier"));
  if (!raw.success || !raw.data) return { error: "Enter your email or mobile number." };
  const email = isEmail(raw.data), phone = normalizePhone(raw.data);
  if (!email && !phone) return { error: "That doesn't look like an email or a PH mobile number (09XX XXX XXXX)." };
  const identifier = email ? raw.data.toLowerCase() : phone!;
  if (!canDeliver(identifier)) return { error: email ? "Email sign-in isn't switched on yet. Try your mobile number, or ask the admin office." : "Text-message sign-in isn't switched on yet. Try your email, or ask the admin office." };
  const ip = clientIp();
  const [a, b] = await Promise.all([rateLimit(`otp-r:${identifier}`, 5, 900), rateLimit(`otp-r-ip:${ip}`, 30, 900)]);
  if (!a.ok || !b.ok) return { error: tooMany(Math.max(a.retryAfterSec, b.retryAfterSec)) };
  try {
    const r = await issueCode(identifier);
    const to = email ? identifier : identifier.replace(/^(\+63)(\d{3})\d{4}(\d{3})$/, "$1 $2 •••• $3");
    return { sent: true, to, identifier, demoCode: r.demoCode };
  } catch (e) {
    await captureError(e, { source: "server", path: "/login (send code)" });
    return { error: "We couldn't send a code just now. Please try again in a minute." };
  }
}
