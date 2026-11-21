"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nowManila, peso } from "@/lib/format";

export async function book(fd: FormData) {
  const u = await requireRole("OWNER");
  const p = z.object({ serviceId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.enum(["09:00", "11:00", "13:00", "15:00"]), qty: z.coerce.number().int().min(1).max(6) }).parse(Object.fromEntries(fd));
  const [unit, sv] = await Promise.all([prisma.unit.findFirst({ where: { ownerId: u.id }, orderBy: { code: "asc" } }), prisma.service.findUnique({ where: { id: p.serviceId } })]);
  if (!unit || !sv) throw new Error("Unit or service not found");
  const slot = new Date(`${p.date}T${p.time}:00+08:00`);
  const dow = new Date(`${p.date}T12:00:00+08:00`).getUTCDay();
  if (slot < nowManila() || dow === 0) redirect("/services?error=" + encodeURIComponent("Please pick a future Monday to Saturday."));
  const b = await prisma.booking.create({ data: { serviceId: sv.id, unitId: unit.id, userId: u.id, slot, qty: p.qty, total: Number(sv.price) * p.qty, payMethod: "Monthly statement" } });
  await audit(u.id, "booking", `Unit ${unit.code} booked ${sv.name}${p.qty > 1 ? ` × ${p.qty}` : ""} for ${slot.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })} (${peso(b.total)})`);
  revalidatePath("/my");
  redirect("/services?booked=" + encodeURIComponent(sv.name));
}
