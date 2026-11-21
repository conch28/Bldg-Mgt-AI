import { NextResponse } from "next/server";
import { handleIncoming, linkSender, validSignature } from "@/lib/channels";
import { captureError } from "@/lib/monitor";

export const dynamic = "force-dynamic";

/** Meta webhook verification handshake. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ok = u.searchParams.get("hub.mode") === "subscribe" && process.env.MESSENGER_VERIFY_TOKEN && u.searchParams.get("hub.verify_token") === process.env.MESSENGER_VERIFY_TOKEN;
  return ok ? new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("Forbidden", { status: 403 });
}

/** Incoming Messenger events. Signed by Meta with the app secret; anything unsigned is dropped. */
export async function POST(req: Request) {
  const body = await req.text();
  if (!validSignature(body, process.env.MESSENGER_APP_SECRET, req.headers.get("x-hub-signature-256"), "sha256=")) return new Response("Bad signature", { status: 401 });
  try {
    const j = JSON.parse(body);
    for (const entry of j.entry ?? []) for (const ev of entry.messaging ?? []) {
      const psid = String(ev.sender?.id ?? "");
      if (!psid) continue;
      const ref = ev.referral?.ref ?? ev.postback?.referral?.ref;
      if (ref && (await linkSender("MESSENGER", psid, ref))) continue;
      if (ev.message?.text && !ev.message.is_echo) await handleIncoming("MESSENGER", psid, ev.message.text);
    }
  } catch (e) { await captureError(e, { source: "api", path: "/api/messenger" }); }
  return NextResponse.json({ ok: true }); // always 200 so Meta doesn't retry-storm
}
