import { NextResponse } from "next/server";
import { handleIncoming, linkSender, validSignature } from "@/lib/channels";
import { captureError } from "@/lib/monitor";

export const dynamic = "force-dynamic";

/** Incoming Viber events. Signed with the bot token; anything unsigned is dropped. */
export async function POST(req: Request) {
  const body = await req.text();
  if (!validSignature(body, process.env.VIBER_TOKEN, req.headers.get("x-viber-content-signature"))) return new Response("Bad signature", { status: 401 });
  try {
    const ev = JSON.parse(body);
    if (ev.event === "conversation_started" && ev.user?.id) await linkSender("VIBER", ev.user.id, ev.context);
    else if (ev.event === "message" && ev.sender?.id && ev.message?.type === "text") await handleIncoming("VIBER", ev.sender.id, String(ev.message.text));
  } catch (e) { await captureError(e, { source: "api", path: "/api/viber" }); }
  return NextResponse.json({ status: 0 });
}
