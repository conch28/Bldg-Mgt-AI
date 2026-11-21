"use server";
import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nowManila } from "@/lib/format";

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => ALPHA[randomInt(ALPHA.length)]).join("");

export async function createPass(fd: FormData) {
  const u = await requireRole("OWNER");
  const p = z.object({ kind: z.enum(["GUEST", "DELIVERY", "CONTRACTOR", "MOVE", "STAY"]), name: z.string().trim().min(2).max(80), plate: z.string().trim().max(12).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), days: z.coerce.number().int().min(1).max(30), note: z.string().max(200).optional() }).safeParse(Object.fromEntries([...fd.entries()].filter(([k]) => k !== "photo")));
  if (!p.success) redirect("/passes?error=" + encodeURIComponent("Add the visitor's name and a date."));
  const unit = await prisma.unit.findFirst({ where: { ownerId: u.id }, orderBy: { code: "asc" } });
  if (!unit) redirect("/passes?error=No+unit+linked");
  const validFrom = new Date(`${p.data.date}T00:00:00+08:00`);
  if (validFrom.getTime() < nowManila().getTime() - 86400000) redirect("/passes?error=" + encodeURIComponent("Pick today or a future date."));
  if (p.data.kind === "STAY" && (validFrom.getTime() - nowManila().getTime() < 86400000 - 12 * 3600000 || p.data.days < 2)) redirect("/passes?error=" + encodeURIComponent("Short stays need 2 nights or more, registered at least a day ahead."));
  const file = fd.get("photo");
  let photo: string | null = null;
  if (file && typeof file === "object" && "size" in file && file.size > 0) {
    if (file.size > 300_000 || !/^image\/(jpeg|png|webp)$/.test(file.type)) redirect("/passes?error=" + encodeURIComponent("The photo must be a JPG, PNG or WebP under 300 KB."));
    photo = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  }
  let code = newCode();
  while (await prisma.pass.findUnique({ where: { code } })) code = newCode();
  const pass = await prisma.pass.create({ data: { code, kind: p.data.kind, name: p.data.name, plate: p.data.plate?.toUpperCase() || null, unitId: unit.id, userId: u.id, validFrom, validTo: new Date(validFrom.getTime() + p.data.days * 86400000 - 1), note: p.data.note || null, photo } });
  await audit(u.id, "pass created", `${pass.kind} ${pass.name} for ${unit.code}`);
  revalidatePath("/passes");
  redirect("/passes?new=" + pass.id);
}

export async function revokePass(fd: FormData) {
  const u = await requireRole("OWNER");
  const pass = await prisma.pass.findUnique({ where: { id: String(fd.get("id")) } });
  if (!pass || pass.userId !== u.id) redirect("/passes");
  await prisma.pass.update({ where: { id: pass.id }, data: { validTo: new Date() } });
  await audit(u.id, "pass revoked", pass.code);
  revalidatePath("/passes");
  redirect("/passes");
}
