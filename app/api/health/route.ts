import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
/** For an uptime monitor (e.g. UptimeRobot or Better Stack): 200 when the app and database answer. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "database" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
