"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { bookSlot } from "@/lib/assist";
import { notifyUser } from "@/lib/comms";

const fail = (m: string) => redirect("/amenities?error=" + encodeURIComponent(m));

export async function bookAmenity(fd: FormData) {
  const u = await requireRole("OWNER");
  const p = z.object({ amenityId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hour: z.coerce.number().int().min(0).max(23), guests: z.coerce.number().int().min(0).max(80) }).parse(Object.fromEntries(fd));
  const r = await bookSlot(u, p);
  if (!r.ok) return fail(r.error);
  revalidatePath("/amenities");
  redirect("/amenities?ok=" + encodeURIComponent(r.message.replace(/\*\*/g, "")));
}

export async function cancelAmenity(fd: FormData) {
  const u = await requireRole("OWNER", "MANAGER", "ADMIN");
  const b = await prisma.amenityBooking.findUnique({ where: { id: String(fd.get("id")) }, include: { amenity: true } });
  if (!b || (u.role === "OWNER" && b.userId !== u.id)) return fail("Booking not found.");
  await prisma.amenityBooking.update({ where: { id: b.id }, data: { status: "CANCELLED" } });
  await audit(u.id, "amenity cancelled", `${b.amenity.name} ${fmtDateTime(b.start)}`);
  if (u.role !== "OWNER") await notifyUser(b.userId, `Booking cancelled: ${b.amenity.name}`, `Your ${b.amenity.name} booking on ${fmtDateTime(b.start)} was cancelled by the admin office. Please message the helpdesk if you have questions.`);
  revalidatePath("/amenities");
  redirect("/amenities?ok=Cancelled.");
}
