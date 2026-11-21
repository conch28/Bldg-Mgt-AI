import { NextResponse } from "next/server";
import { runAutomations } from "@/lib/comms";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called daily by Vercel Cron (vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json(await runAutomations());
}
