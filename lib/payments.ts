import { demoMode } from "./env";
/**
 * Online payments through PayMongo Checkout (GCash, Maya, cards).
 * Without PAYMONGO_SECRET_KEY the app runs in test mode: the Pay button records
 * a simulated payment, which is allowed only outside production or when
 * ALLOW_TEST_PAYMENTS=1.
 */
import crypto from "crypto";

export const paymongoEnabled = () => Boolean(process.env.PAYMONGO_SECRET_KEY);
export const testPaymentsAllowed = () => !paymongoEnabled() && (process.env.NODE_ENV !== "production" || process.env.ALLOW_TEST_PAYMENTS === "1" || demoMode());

export async function createCheckout(opts: { amount: number; description: string; reference: string; successUrl: string; cancelUrl: string; email?: string }) {
  const auth = Buffer.from(process.env.PAYMONGO_SECRET_KEY + ":").toString("base64");
  const r = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data: { attributes: {
      line_items: [{ amount: Math.round(opts.amount * 100), currency: "PHP", name: opts.description, quantity: 1 }],
      payment_method_types: ["gcash", "paymaya", "card"], reference_number: opts.reference, description: opts.description,
      success_url: opts.successUrl, cancel_url: opts.cancelUrl, send_email_receipt: Boolean(opts.email),
      ...(opts.email ? { billing: { email: opts.email } } : {}),
    } } }),
  });
  if (!r.ok) throw new Error(`PayMongo error ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.data.attributes.checkout_url as string;
}

/** Verifies the Paymongo-Signature header (t=timestamp,te=test sig,li=live sig). */
export function verifyWebhook(raw: string, header: string | null) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
  const got = parts.li || parts.te || "";
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
