import { NextResponse } from "next/server";
import { currentUser, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await currentUser();
  if (!u) return new NextResponse("Sign in first", { status: 401 });
  const d = await prisma.document.findUnique({ where: { id: params.id } });
  if (!d || (d.visibility === "BOARD" && !["BOARD", "MANAGER", "ADMIN"].includes(u.role))) return new NextResponse("Not found", { status: 404 });
  await audit(u.id, "document viewed", d.title);
  const inline = ["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(d.mime);
  return new NextResponse(new Uint8Array(d.data), { headers: {
    "Content-Type": d.mime, "Content-Length": String(d.size), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${d.fileName.replace(/[^\w.\- ]/g, "_")}"`,
  } });
}
