import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { helpdeskReply } from "@/lib/ai";
import { rateLimit } from "@/lib/ratelimit";
import { captureError } from "@/lib/monitor";


export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const [m, d] = await Promise.all([rateLimit(`chat:${user.id}`, 12, 60), rateLimit(`chat-day:${user.id}`, 150, 86400)]);
  if (!m.ok || !d.ok) return NextResponse.json({ error: m.ok ? "You've reached today's message limit. The admin office can still help you po." : "You're sending messages quickly. Please wait a minute." }, { status: 429 });
  const parsed = z.object({ message: z.string().trim().min(1).max(2000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message is empty or too long." }, { status: 400 });
  const text = parsed.data.message;
  try {
    const { reply, ai } = await helpdeskReply(user, text);
    const t = new Date();
    await prisma.chatMessage.createMany({ data: [{ userId: user.id, role: "user", content: text, createdAt: t }, { userId: user.id, role: "assistant", content: reply, createdAt: new Date(t.getTime() + 1) }] });
    return NextResponse.json({ reply, ai });
  } catch (e) {
    await captureError(e, { source: "api", path: "/api/chat", userId: user.id });
    return NextResponse.json({ error: "The assistant is unavailable right now. Please try again, or message the admin office." }, { status: 502 });
  }
}
