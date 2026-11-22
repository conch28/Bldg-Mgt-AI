"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, PEOPLE, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { GROUPS } from "@/lib/community";

// Light guard-rail: posts with slurs or someone's phone number are held back for the manager to review.
const BLOCK = /\b(putang ?ina|tangina|gago|bobo|ulol|fuck|shit)\b/i;
const PHONE = /(\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}/;

export async function createPost(fd: FormData) {
  const u = await requireRole("OWNER", "BOARD", "MANAGER", "ADMIN");
  const p = z.object({ body: z.string().trim().min(2).max(800), group: z.enum(GROUPS), staffName: z.string().trim().max(80).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/neighbors?error=" + encodeURIComponent("Write something first."));
  if (p.data.group === "Kudos" && !p.data.staffName) redirect("/neighbors?tab=kudos&error=" + encodeURIComponent("Pick who you're thanking."));
  if (!(await rateLimit(`post:${u.id}`, 6, 3600)).ok) redirect("/neighbors?error=" + encodeURIComponent("You've posted a lot this hour. Try again later po."));
  const unit = await prisma.unit.findFirst({ where: { ownerId: u.id }, orderBy: { code: "asc" } });
  const hidden = BLOCK.test(p.data.body) || PHONE.test(p.data.body);
  await prisma.post.create({ data: { userId: u.id, authorName: u.name, unitCode: unit?.code ?? null, group: p.data.group, body: p.data.body, staffName: p.data.group === "Kudos" ? p.data.staffName : null, hidden } });
  await audit(u.id, "post", `${p.data.group}${hidden ? " (held for review)" : ""}`);
  revalidatePath("/neighbors");
  redirect(`/neighbors?tab=${p.data.group === "Kudos" ? "kudos" : "feed"}&ok=` + encodeURIComponent(hidden ? "Thanks po. Your post is waiting for a quick review because it has a phone number or strong words." : "Posted."));
}

export async function likePost(fd: FormData) {
  const u = await requireRole(...PEOPLE);
  const postId = String(fd.get("id"));
  const had = await prisma.postLike.findUnique({ where: { postId_userId: { postId, userId: u.id } } });
  if (had) await prisma.postLike.delete({ where: { id: had.id } }); else await prisma.postLike.create({ data: { postId, userId: u.id } }).catch(() => null);
  revalidatePath("/neighbors");
  redirect("/neighbors?tab=" + (String(fd.get("tab")) || "feed"));
}

export async function moderatePost(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const post = await prisma.post.findUnique({ where: { id: String(fd.get("id")) } });
  if (!post) redirect("/neighbors");
  const hide = fd.get("hide") === "1";
  await prisma.post.update({ where: { id: post.id }, data: { hidden: hide } });
  await audit(u.id, hide ? "post hidden" : "post approved", post.id);
  revalidatePath("/neighbors");
  redirect("/neighbors?ok=" + (hide ? "Hidden" : "Approved"));
}

export async function deletePost(fd: FormData) {
  const u = await requireRole(...PEOPLE);
  const post = await prisma.post.findUnique({ where: { id: String(fd.get("id")) } });
  if (!post || (post.userId !== u.id && u.role !== "MANAGER" && u.role !== "ADMIN")) redirect("/neighbors");
  await prisma.post.delete({ where: { id: post.id } });
  await audit(u.id, "post deleted", post.id);
  revalidatePath("/neighbors");
  redirect("/neighbors?ok=Deleted");
}

export async function createEvent(fd: FormData) {
  const u = await requireRole("OWNER", "BOARD", "MANAGER", "ADMIN");
  const p = z.object({ title: z.string().trim().min(3).max(100), detail: z.string().trim().max(600).optional(), group: z.enum(GROUPS), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/), place: z.string().trim().min(2).max(100) }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/neighbors?tab=events&error=" + encodeURIComponent("Add a title, date, time and place."));
  const startsAt = new Date(`${p.data.date}T${p.data.time}:00+08:00`);
  if (startsAt < new Date()) redirect("/neighbors?tab=events&error=" + encodeURIComponent("Pick a future date."));
  const e = await prisma.event.create({ data: { title: p.data.title, detail: p.data.detail || null, group: p.data.group, startsAt, place: p.data.place, createdBy: u.id, hostName: u.name } });
  await prisma.eventRsvp.create({ data: { eventId: e.id, userId: u.id, name: u.name } });
  await audit(u.id, "event created", e.title);
  revalidatePath("/neighbors");
  redirect("/neighbors?tab=events&ok=" + encodeURIComponent("Event posted. Book the room on the Amenities page if you need one."));
}

export async function rsvp(fd: FormData) {
  const u = await requireRole(...PEOPLE);
  const eventId = String(fd.get("id"));
  const had = await prisma.eventRsvp.findUnique({ where: { eventId_userId: { eventId, userId: u.id } } });
  if (had) await prisma.eventRsvp.delete({ where: { id: had.id } }); else await prisma.eventRsvp.create({ data: { eventId, userId: u.id, name: u.name } }).catch(() => null);
  revalidatePath("/neighbors");
  redirect("/neighbors?tab=events");
}
