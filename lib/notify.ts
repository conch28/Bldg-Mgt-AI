/**
 * Outbound channels. Each one is live only when its keys are set; otherwise the
 * message is recorded as LOGGED so the app works end to end without accounts.
 *   SMS       Semaphore (PH)          SEMAPHORE_API_KEY, SEMAPHORE_SENDER
 *   Email     Resend                  RESEND_API_KEY, EMAIL_FROM
 *   Messenger Meta Graph API (Page)   MESSENGER_PAGE_TOKEN
 */
export type SendResult = { status: "SENT" | "LOGGED" | "FAILED"; info: string };

export const channelStatus = () => ({
  SMS: Boolean(process.env.SEMAPHORE_API_KEY),
  EMAIL: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  MESSENGER: Boolean(process.env.MESSENGER_PAGE_TOKEN),
});

export async function sendSms(to: string | null | undefined, message: string): Promise<SendResult> {
  const key = process.env.SEMAPHORE_API_KEY;
  if (!to) return { status: "FAILED", info: "No mobile number" };
  if (!key) return { status: "LOGGED", info: "SMS not connected" };
  try {
    const body = new URLSearchParams({ apikey: key, number: to.replace(/[^\d+]/g, ""), message, ...(process.env.SEMAPHORE_SENDER ? { sendername: process.env.SEMAPHORE_SENDER } : {}) });
    const r = await fetch("https://api.semaphore.co/api/v4/messages", { method: "POST", body });
    return r.ok ? { status: "SENT", info: "SMS sent" } : { status: "FAILED", info: `SMS error ${r.status}` };
  } catch (e) { return { status: "FAILED", info: "SMS error: " + (e as Error).message }; }
}

export async function sendEmail(to: string | null | undefined, subject: string, text: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  if (!to) return { status: "FAILED", info: "No email" };
  if (!key || !from) return { status: "LOGGED", info: "Email not connected" };
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#14231f;max-width:560px">${text
    .split("\n").map((l) => l.trim() ? `<p style="margin:0 0 10px">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "").join("")}<p style="color:#5b6b67;font-size:12px;margin-top:20px">Skyland Plaza · managed by Building Mgt AI. Change how you get updates in the owner portal under Account.</p></div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to, subject, html, text }) });
    return r.ok ? { status: "SENT", info: "Email sent" } : { status: "FAILED", info: `Email error ${r.status}` };
  } catch (e) { return { status: "FAILED", info: "Email error: " + (e as Error).message }; }
}

export async function sendMessenger(psid: string | null | undefined, text: string): Promise<SendResult> {
  const token = process.env.MESSENGER_PAGE_TOKEN;
  if (!psid) return { status: "FAILED", info: "Messenger not linked" };
  if (!token) return { status: "LOGGED", info: "Messenger not connected" };
  try {
    // Outside the 24-hour window, Meta only allows tagged messages; ACCOUNT_UPDATE covers notices about the owner's account and building.
    const r = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(token)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: psid }, messaging_type: "MESSAGE_TAG", tag: "ACCOUNT_UPDATE", message: { text: text.slice(0, 1900) } }),
    });
    return r.ok ? { status: "SENT", info: "Messenger sent" } : { status: "FAILED", info: `Messenger error ${r.status}` };
  } catch (e) { return { status: "FAILED", info: "Messenger error: " + (e as Error).message }; }
}
