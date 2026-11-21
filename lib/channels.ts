/**
 * Resident assistant on Messenger and Viber. Same brain as the in-app helpdesk (helpdeskReply),
 * same tools, one conversation history across channels.
 *
 * Linking: the owner taps "Link Messenger" / "Link Viber" in My account. The link carries a signed token
 * (m.me ref / Viber context) and the webhook stores the sender id on the user. Unlinked senders get
 * instructions only; nothing about any account is ever sent to an unknown sender.
 *
 * Env: MESSENGER_PAGE_TOKEN, MESSENGER_APP_SECRET, MESSENGER_VERIFY_TOKEN, MESSENGER_PAGE (page username)
 *      VIBER_TOKEN, VIBER_URI (public account URI)
 */
import crypto from "crypto";
import { prisma } from "./db";
import { authSecret } from "./env";
import { helpdeskReply } from "./ai";
import { sendMessenger, type SendResult } from "./notify";
import { rateLimit } from "./ratelimit";
import { audit, type SessionUser } from "./auth";

export type Channel = "MESSENGER" | "VIBER";
const sig = (s: string) => crypto.createHmac("sha256", authSecret()).update("link:" + s).digest("base64url").slice(0, 16);
export const linkToken = (userId: string) => `${userId}.${sig(userId)}`;
export function userFromToken(t: string | null | undefined): string | null {
  if (!t) return null;
  const [id, s] = t.split(".");
  if (!id || !s || s.length !== 16) return null;
  return crypto.timingSafeEqual(Buffer.from(s), Buffer.from(sig(id))) ? id : null;
}
export const linkUrls = (userId: string) => ({
  messenger: process.env.MESSENGER_PAGE ? `https://m.me/${process.env.MESSENGER_PAGE}?ref=${linkToken(userId)}` : null,
  viber: process.env.VIBER_URI ? `viber://pa?chatURI=${process.env.VIBER_URI}&context=${linkToken(userId)}` : null,
});
export const channelSetup = () => ({
  MESSENGER: Boolean(process.env.MESSENGER_PAGE_TOKEN && process.env.MESSENGER_APP_SECRET && process.env.MESSENGER_VERIFY_TOKEN),
  VIBER: Boolean(process.env.VIBER_TOKEN),
});

/** Checks an HMAC-SHA256 webhook signature (hex). */
export function validSignature(body: string, secret: string | undefined, got: string | null, prefix = "") {
  if (!secret || !got) return false;
  const want = prefix + crypto.createHmac("sha256", secret).update(body).digest("hex");
  return want.length === got.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got));
}

export async function sendViber(id: string, text: string): Promise<SendResult> {
  const token = process.env.VIBER_TOKEN;
  if (!token) { console.log(`[viber:log] ${id}: ${text}`); return { status: "LOGGED", info: "Viber not connected" }; }
  try {
    const r = await fetch("https://chatapi.viber.com/pa/send_message", { method: "POST", headers: { "X-Viber-Auth-Token": token, "Content-Type": "application/json" }, body: JSON.stringify({ receiver: id, type: "text", sender: { name: "Skyland Helpdesk" }, text }) });
    const j = await r.json().catch(() => ({}));
    return j.status === 0 ? { status: "SENT", info: "ok" } : { status: "FAILED", info: j.status_message ?? String(r.status) };
  } catch (e) { return { status: "FAILED", info: (e as Error).message }; }
}
export const sendOn = (ch: Channel, id: string, text: string) => (ch === "MESSENGER" ? sendMessenger(id, text) : sendViber(id, text));

const HOW_TO_LINK = "Hi po! This is the Skyland Plaza helpdesk. To chat about your unit here, open the Skyland app, go to My account, and tap \"Link Messenger\" or \"Link Viber\". Para sa emergency, tawagan po ang guard house: local 100.";

/** Link a sender to the owner named in a signed token. */
export async function linkSender(ch: Channel, senderId: string, token: string | null | undefined) {
  const userId = userFromToken(token);
  if (!userId) return false;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return false;
  await prisma.user.update({ where: { id: user.id }, data: ch === "MESSENGER" ? { messengerPsid: senderId, notifyMessenger: true } : { viberId: senderId } });
  await audit(user.id, `${ch.toLowerCase()} linked`, user.email);
  await sendOn(ch, senderId, `Salamat, ${user.name.split(" ")[0]}! Your ${ch === "MESSENGER" ? "Messenger" : "Viber"} is now linked po. Ask me about your balance, report a repair, book a service, or say "tao po" to reach the manager.`);
  return true;
}

/** Reply to one incoming text message from a channel. */
export async function handleIncoming(ch: Channel, senderId: string, text: string) {
  const user = await prisma.user.findFirst({ where: ch === "MESSENGER" ? { messengerPsid: senderId, active: true } : { viberId: senderId, active: true } });
  if (!user) { await sendOn(ch, senderId, HOW_TO_LINK); return; }
  const rl = await rateLimit(`chan:${user.id}`, 12, 60);
  if (!rl.ok) { await sendOn(ch, senderId, "You're sending messages quickly po. Please wait a minute."); return; }
  const reply = await channelReply(user, ch, text.slice(0, 2000));
  await sendOn(ch, senderId, reply.reply);
}

/** The shared brain: answer as the helpdesk, and keep one history across app, Messenger and Viber. */
export async function channelReply(user: { id: string; name: string; email: string; role: any; buildingId: string }, ch: Channel, text: string) {
  const su: SessionUser = { id: user.id, name: user.name, email: user.email, role: user.role, buildingId: user.buildingId };
  const r = await helpdeskReply(su, text);
  const t = new Date();
  await prisma.chatMessage.createMany({ data: [{ userId: user.id, role: "user", content: text, channel: ch, createdAt: t }, { userId: user.id, role: "assistant", content: r.reply, channel: ch, createdAt: new Date(t.getTime() + 1) }] });
  return r;
}
