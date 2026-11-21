import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

const COLUMNS = ["unit", "floor", "sqm", "owner_name", "owner_email", "owner_mobile", "balance_due", "balance_as_of"];
const SAMPLE = [
  COLUMNS.join(","),
  "1202B,12,137,Juan Dela Cruz,juan@example.com,0917 123 4567,0,",
  "12C,12,32,Maria Santos,maria@example.com,09181234567,8450.50,2026-10",
  "PH-1,40,120,\"Lim, Robert\",,0920 555 0101,25000,2026-10",
];
export async function GET() {
  const u = await currentUser();
  if (!u || u.role !== "ADMIN") return new NextResponse("Not found", { status: 404 });
  return new NextResponse(SAMPLE.join("\r\n") + "\r\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="skyland-units-owners-dues-template.csv"', "Cache-Control": "no-store" } });
}
