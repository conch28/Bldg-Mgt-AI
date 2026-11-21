"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function postItem(fd: FormData) {
  const u = await requireRole("OWNER");
  const p = z.object({ title: z.string().trim().min(3).max(80), category: z.string().max(30), price: z.coerce.number().min(0).max(10_000_000).optional(), description: z.string().trim().max(400).default("") }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/community?error=" + encodeURIComponent("Add a title for your item."));
  await prisma.marketItem.create({ data: { ...p.data, price: p.data.price ?? null, userId: u.id } });
  revalidatePath("/community");
  redirect("/community");
}
export async function markSold(fd: FormData) {
  const u = await requireRole("OWNER", "MANAGER", "ADMIN");
  const it = await prisma.marketItem.findUnique({ where: { id: String(fd.get("id")) } });
  if (!it || (u.role === "OWNER" && it.userId !== u.id)) redirect("/community");
  await prisma.marketItem.update({ where: { id: it.id }, data: { status: u.role === "OWNER" ? "SOLD" : "REMOVED" } });
  if (u.role !== "OWNER") await audit(u.id, "marketplace item removed", it.title);
  revalidatePath("/community");
  redirect("/community");
}
export async function reportLostFound(fd: FormData) {
  const u = await requireRole("OWNER", "GUARD", "MANAGER", "ADMIN");
  const p = z.object({ kind: z.enum(["LOST", "FOUND"]), title: z.string().trim().min(3).max(80), place: z.string().trim().min(2).max(80), description: z.string().max(300).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/community?tab=lost&error=" + encodeURIComponent("Say what it is and where."));
  await prisma.lostFound.create({ data: { ...p.data, userId: u.id } });
  revalidatePath("/community");
  redirect("/community?tab=lost");
}
export async function markReturned(fd: FormData) {
  const u = await requireRole("OWNER", "GUARD", "MANAGER", "ADMIN");
  const it = await prisma.lostFound.findUnique({ where: { id: String(fd.get("id")) } });
  if (!it || (u.role === "OWNER" && it.userId !== u.id)) redirect("/community?tab=lost");
  await prisma.lostFound.update({ where: { id: it.id }, data: { status: "RETURNED" } });
  await audit(u.id, "lost and found returned", it.title);
  revalidatePath("/community");
  redirect("/community?tab=lost");
}
