"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nowManila, fmtDateTime } from "@/lib/format";
import { notifyUser } from "@/lib/comms";

const fail = (m: string) => redirect("/amenities?error=" + encodeURIComponent(m));

export async function bookAmenity(fd: FormData) {
  const u = await requireRole("OWNER");
  const p = z.object({ amenityId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hour: z.coerce.number().int().min(0).max(23), guests: z.coerce.number().int().min(0).max(80) }).parse(Object.fromEntries(fd));
  const [unit, a] = await Promise.all([prisma.unit.findFirst({ where: { ownerId: u.id } }), prisma.amenity.findUnique({ where: { id: p.amenityId } })]);
  if (!unit || !a) return fail("Unit or amenity not found.");
  const start = new Date(`${p.date}T${String(p.hour).padStart(2, "0")}:00:00+08:00`);
  const end = new Date(start.getTime() + a.slotHours * 3600000);
  const dow = new Date(`${p.date}T12:00:00+08:00`).getUTCDay();
  if (start < nowManila()) return fail("Please pick a time in the future.");
  if (a.closedDow === dow) return fail(`${a.name} is closed that day.`);
  if (p.hour < a.openHour || p.hour + a.slotHours > a.closeHour) return fail(`${a.name} is open ${a.openHour}:00 to ${a.closeHour}:00.`);
  if (p.guests + 1 > a.capacity) return fail(`${a.name} fits up to ${a.capacity} people.`);
  const overdue = await prisma.bill.count({ where: { unitId: unit.id, status: { not: "PAID" }, dueDate: { lt: new Date(nowManila().getTime() - 60 * 86400000) } } });
  if (overdue) return fail("Amenity booking is paused for accounts over 60 days late. Please settle your dues first, or message the helpdesk.");
  // capacity-based amenities (gym, pool) allow overlapping bookings until full; exclusive ones (function room, court) allow one
  const exclusive = /court|room|grill|karaoke|lounge/i.test(a.name);
  const clash = await prisma.amenityBooking.findMany({ where: { amenityId: a.id, status: "CONFIRMED", start: { lt: end }, end: { gt: start } } });
  if (exclusive && clash.length) return fail(`${a.name} is already booked at that time. Try another slot.`);
  if (!exclusive && clash.reduce((s, b) => s + b.guests + 1, 0) + p.guests + 1 > a.capacity) return fail(`${a.name} is full at that time.`);
  const b = await prisma.amenityBooking.create({ data: { amenityId: a.id, unitId: unit.id, userId: u.id, start, end, guests: p.guests } });
  await audit(u.id, "amenity booking", `Unit ${unit.code} booked ${a.name} ${fmtDateTime(start)}`);
  await notifyUser(u.id, `Booked: ${a.name}`, `Your booking for ${a.name} on ${fmtDateTime(start)} is confirmed${Number(a.fee) ? `. A fee of ₱${Number(a.fee).toLocaleString()} will appear on your next statement` : ""}. Show this message at the front desk.`, ["APP"]);
  revalidatePath("/amenities");
  redirect("/amenities?ok=" + encodeURIComponent(`${a.name} booked for ${fmtDateTime(b.start)}.`));
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
