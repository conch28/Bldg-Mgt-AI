"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issuePass } from "@/lib/assist";

export async function createPass(fd: FormData) {
  const u = await requireRole("OWNER");
  const p = z.object({ kind: z.enum(["GUEST", "PARKING", "DELIVERY", "CONTRACTOR", "MOVE", "STAY"]), name: z.string().trim().min(2).max(80), plate: z.string().trim().max(12).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), days: z.coerce.number().int().min(1).max(30), note: z.string().max(200).optional() }).safeParse(Object.fromEntries([...fd.entries()].filter(([k]) => k !== "photo")));
  if (!p.success) redirect("/passes?error=" + encodeURIComponent("Add the visitor's name and a date."));
  const file = fd.get("photo");
  let photo: string | null = null;
  if (file && typeof file === "object" && "size" in file && file.size > 0) {
    if (file.size > 300_000 || !/^image\/(jpeg|png|webp)$/.test(file.type)) redirect("/passes?error=" + encodeURIComponent("The photo must be a JPG, PNG or WebP under 300 KB."));
    photo = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  }
  const r = await issuePass(u, { ...p.data, photo });
  if (!r.ok) redirect("/passes?error=" + encodeURIComponent(r.error));
  revalidatePath("/passes");
  redirect("/passes?new=" + r.id);
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
