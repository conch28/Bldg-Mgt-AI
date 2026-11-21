import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { captureError } from "@/lib/monitor";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/** Browser-side crashes (from the error screens) are reported here. */
export async function POST(req: Request) {
  if (!(await rateLimit(`clienterr:${clientIp(req.headers)}`, 20, 600)).ok) return new NextResponse(null, { status: 204 });
  const p = z.object({ message: z.string().max(500), digest: z.string().max(100).optional(), path: z.string().max(300).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return new NextResponse(null, { status: 204 });
  const u = await currentUser().catch(() => null);
  await captureError(new Error(p.data.message), { source: "client", path: p.data.path, userId: u?.id, extra: p.data.digest ? `digest ${p.data.digest}` : undefined });
  return new NextResponse(null, { status: 204 });
}
