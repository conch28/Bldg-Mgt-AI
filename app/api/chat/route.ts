import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { helpdeskReply } from "@/lib/ai";

// Very small in-memory rate limit per user (per server instance).
const hits = new Map<string, number[]>();

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const now = Date.now(); const h = (hits.get(user.id) ?? []).filter((t) => now - t < 60_000);
  if (h.length >= 12) return NextResponse.json({ error: "You're sending messages quickly. Please wait a minute." }, { status: 429 });
  hits.set(user.id, [...h, now]);
  const parsed = z.object({ message: z.string().trim().min(1).max(2000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message is empty or too long." }, { status: 400 });
  const text = parsed.data.message;
  try {
    const { reply, ai } = await helpdeskReply(user, text);
    const t = new Date();
    await prisma.chatMessage.createMany({ data: [{ userId: user.id, role: "user", content: text, createdAt: t }, { userId: user.id, role: "assistant", content: reply, createdAt: new Date(t.getTime() + 1) }] });
    return NextResponse.json({ reply, ai });
  } catch (e) {
    console.error("chat error", e);
    await audit(user.id, "chat_error", (e as Error).message.slice(0, 300));
    return NextResponse.json({ error: "The assistant is unavailable right now. Please try again, or message the admin office." }, { status: 502 });
  }
}
