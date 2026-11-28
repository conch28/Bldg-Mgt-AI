import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { askAdvisor } from "@/lib/ai";
import { rateLimit } from "@/lib/ratelimit";
import { captureError } from "@/lib/monitor";

const ALLOWED = ["OWNER", "BOARD", "MANAGER", "ADMIN"];
const Body = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) })).max(16).default([]),
});

/** Ask AI. Questions are not stored: the conversation lives in the person's browser tab only. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!ALLOWED.includes(user.role)) return NextResponse.json({ error: "Ask AI is for residents and the board." }, { status: 403 });
  const [m, d] = await Promise.all([rateLimit(`ask:${user.id}`, 10, 60), rateLimit(`ask-day:${user.id}`, 120, 86400)]);
  if (!m.ok || !d.ok) return NextResponse.json({ error: m.ok ? "You've reached today's question limit. The admin office can still help you po." : "You're asking quickly. Please wait a minute po." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Question is empty or too long." }, { status: 400 });
  try {
    return NextResponse.json(await askAdvisor(user, parsed.data.message, parsed.data.history));
  } catch (e) {
    await captureError(e, { source: "api", path: "/api/ask", userId: user.id });
    return NextResponse.json({ error: "Ask AI is unavailable right now. Please try again, or tap Talk to a person." }, { status: 502 });
  }
}
