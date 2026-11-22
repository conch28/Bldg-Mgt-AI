import { NextResponse } from "next/server";
import { runAutomations } from "@/lib/comms";
import { captureError, pruneErrors } from "@/lib/monitor";
import { pruneRateLimits } from "@/lib/ratelimit";
import { pruneCodes } from "@/lib/otp";
import { runDutyNudges } from "@/lib/duties";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called daily by Vercel Cron (vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const result = await runAutomations();
    const duties = await runDutyNudges(); // overdue records: remind the owner, then the supervisor, then the board
    const [codes, limits, errors] = await Promise.all([pruneCodes(), pruneRateLimits(), pruneErrors()]); // retention limits from the privacy notice
    return NextResponse.json({ ...result, duties, pruned: { codes: codes.count, limits: limits.count, errors: errors.count } });
  } catch (e) {
    await captureError(e, { source: "cron", path: "/api/cron" });
    return NextResponse.json({ error: "automation failed" }, { status: 500 });
  }
}
