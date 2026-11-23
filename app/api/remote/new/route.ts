// Phone remote for the 3D city map: the big screen asks for a short-lived code and shows it as a QR.
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";

export async function POST() {
  const u = await currentUser();
  if (!u || !["CLIENT", "BOARD", "MANAGER", "ADMIN"].includes(u.role)) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const code = Array.from(randomBytes(10), (b) => ALPHA[b % ALPHA.length]).join("");
  await prisma.mapRemote.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.mapRemote.create({ data: { code, expiresAt: new Date(Date.now() + 3 * 3600_000), createdBy: u.id } });
  return NextResponse.json({ code });
}
