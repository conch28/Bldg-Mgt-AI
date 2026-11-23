// Phone remote relay: the screen polls GET for the latest command; the phone POSTs commands; the screen PUTs what it shows.
// The code is the only key (10 random characters, 3-hour life), so commands are limited to a fixed list.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { REMOTE_CMD_LIST } from "@/lib/remote";

export const dynamic = "force-dynamic";
const ok = (c: string) => /^[a-z2-9]{10}$/.test(c);
async function live(code: string) {
  if (!ok(code)) return null;
  const r = await prisma.mapRemote.findUnique({ where: { code } });
  return r && r.expiresAt > new Date() ? r : null;
}

export async function GET(_: Request, { params }: { params: { code: string } }) {
  const r = await live(params.code);
  if (!r) return NextResponse.json({ error: "This remote code has expired." }, { status: 404 });
  return NextResponse.json({ seq: r.seq, cmd: r.cmd, state: r.state }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const lim = await rateLimit(`remote:${clientIp(req.headers)}`, 90, 60);
  if (!lim.ok) return NextResponse.json({ error: "Too many taps. Wait a moment." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { cmd?: string };
  const cmd = String(body.cmd ?? "");
  if (!REMOTE_CMD_LIST.includes(cmd)) return NextResponse.json({ error: "Unknown command." }, { status: 400 });
  if (!(await live(params.code))) return NextResponse.json({ error: "This remote code has expired." }, { status: 404 });
  const r = await prisma.mapRemote.update({ where: { code: params.code }, data: { cmd, seq: { increment: 1 } } });
  return NextResponse.json({ seq: r.seq });
}

export async function PUT(req: Request, { params }: { params: { code: string } }) {
  const body = (await req.json().catch(() => ({}))) as { state?: string };
  if (!(await live(params.code))) return NextResponse.json({ error: "expired" }, { status: 404 });
  await prisma.mapRemote.update({ where: { code: params.code }, data: { state: String(body.state ?? "").slice(0, 120) } });
  return NextResponse.json({ ok: true });
}
