import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { templateByKey } from "@/lib/templates";
import { csvCell } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** CSV onboarding template: header row, then one EXAMPLE row to delete before filling in. */
export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const u = await currentUser();
  if (!u || !["BOARD", "MANAGER", "ADMIN"].includes(u.role)) return new NextResponse("Not allowed", { status: 403 });
  const t = templateByKey(params.name);
  if (!t) return new NextResponse("Unknown template", { status: 404 });
  const body = [t.cols.map((c) => c.name).join(","), t.cols.map((c) => csvCell(c.example)).join(",")].join("\r\n") + "\r\n";
  return new NextResponse("﻿" + body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${String(t.n).padStart(2, "0")}-${t.key}-template.csv"`, "Cache-Control": "no-store" } });
}
