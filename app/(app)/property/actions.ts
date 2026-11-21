"use server";
import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/lib/comms";
import { demoMode } from "@/lib/env";
import { fmtDateTime } from "@/lib/format";
import { answerInquiry, BROKER, nextViewingSlot, priceCheck, publishListing, writeListing } from "@/lib/property";

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => ALPHA[randomInt(ALPHA.length)]).join("");

async function mine(id: string, userId: string) {
  const l = await prisma.listing.findUnique({ where: { id }, include: { unit: true } });
  if (!l || l.userId !== userId) redirect("/property");
  return l;
}

export async function createListing(fd: FormData) {
  const u = await requireRole("OWNER");
  const p = z.object({ unitId: z.string(), kind: z.enum(["LEASE", "SALE"]), beds: z.coerce.number().int().min(0).max(4), furnished: z.enum(["BARE", "SEMI", "FULL"]), price: z.coerce.number().positive().max(500_000_000), notes: z.string().max(600).default(""), channels: z.array(z.enum(["FB_PAGE", "FB_MARKETPLACE", "FB_GROUPS"])).min(1) })
    .safeParse({ ...Object.fromEntries(fd), channels: fd.getAll("channels") });
  if (!p.success) redirect("/property/new?error=" + encodeURIComponent("Pick a price and at least one place to post."));
  const unit = await prisma.unit.findFirst({ where: { id: p.data.unitId, ownerId: u.id } });
  if (!unit) redirect("/property");
  const pc = await priceCheck(p.data.kind, { sqm: Number(unit.sqm), floor: unit.floor }, p.data.beds, p.data.furnished);
  const copy = await writeListing({ kind: p.data.kind, unitCode: unit.code, floor: unit.floor, sqm: Number(unit.sqm), beds: p.data.beds, furnished: p.data.furnished, price: p.data.price, notes: p.data.notes });
  const l = await prisma.listing.create({ data: {
    unitId: unit.id, userId: u.id, kind: p.data.kind, status: "DRAFT", price: p.data.price, suggestedLow: pc.low, suggestedHigh: pc.high, beds: p.data.beds, furnished: p.data.furnished,
    title: copy.title, body: copy.body, bodyTl: copy.bodyTl, highlights: copy.highlights, rationale: pc.note, channels: p.data.channels, ai: copy.ai, broker: `${BROKER.name}, ${BROKER.license}`,
  } });
  await audit(u.id, "listing drafted", `${l.kind} ${unit.code} at ${p.data.price}`);
  redirect(`/property/${l.id}`);
}

export async function approveListing(fd: FormData) {
  const u = await requireRole("OWNER");
  const l = await mine(String(fd.get("id")), u.id);
  if (l.status !== "DRAFT") redirect(`/property/${l.id}`);
  const posts = await publishListing(l);
  await prisma.listing.update({ where: { id: l.id }, data: { status: "LIVE", posts, publishedAt: new Date() } });
  await audit(u.id, "listing published", `${l.kind} ${l.unit.code}: ${posts.map((p) => `${p.channel} ${p.status}`).join(", ")}`);
  revalidatePath("/property");
  redirect(`/property/${l.id}?published=1`);
}

export async function withdrawListing(fd: FormData) {
  const u = await requireRole("OWNER");
  const l = await mine(String(fd.get("id")), u.id);
  await prisma.listing.update({ where: { id: l.id }, data: { status: "WITHDRAWN" } });
  await audit(u.id, "listing withdrawn", l.unit.code);
  revalidatePath("/property");
  redirect("/property");
}

const PEOPLE = ["Joanna Lim", "Mark Villanueva", "Kenji Sato", "Bea Santos", "Rafael Cruz", "Priya Nair", "Lea Gonzales", "Daniel Ong"];
const ASKS = {
  LEASE: ["Hi, is this still available? Can I view this weekend?", "Magkano po ang move-in? Pwede po ba pets?", "Available pa po ba? Looking for 1 year lease starting next month.", "Hello! Is parking included? I work nearby in BGC."],
  SALE: ["Is the price negotiable? Pre-approved ako sa bank.", "Hi, can I see the unit this week? Cash buyer.", "Clean title po ba? How much are the monthly dues?"],
};
/** Demo only: a new message arrives from Facebook and the AI answers it. */
export async function simulateInquiry(fd: FormData) {
  const u = await requireRole("OWNER");
  if (!demoMode()) redirect("/property");
  const l = await mine(String(fd.get("id")), u.id);
  const name = PEOPLE[randomInt(PEOPLE.length)], asks = ASKS[l.kind as "LEASE" | "SALE"], message = asks[randomInt(asks.length)];
  const slot = await nextViewingSlot(l.id);
  const { reply } = await answerInquiry({ kind: l.kind, price: Number(l.price), title: l.title, body: l.body }, name.split(" ")[0], message, slot);
  const channel = ["MESSENGER", "MARKETPLACE", "GROUP"][randomInt(3)];
  await prisma.inquiry.create({ data: { listingId: l.id, name, channel, message, aiReply: reply, status: "ANSWERED" } });
  await prisma.listing.update({ where: { id: l.id }, data: { views: { increment: 20 + randomInt(60) } } });
  revalidatePath(`/property/${l.id}`);
  redirect(`/property/${l.id}#inquiries`);
}

export async function bookViewing(fd: FormData) {
  const u = await requireRole("OWNER");
  const inq = await prisma.inquiry.findUnique({ where: { id: String(fd.get("inquiryId")) }, include: { listing: { include: { unit: true } } } });
  if (!inq || inq.listing.userId !== u.id) redirect("/property");
  const slot = await nextViewingSlot(inq.listingId);
  let code = newCode(); while (await prisma.pass.findUnique({ where: { code } })) code = newCode();
  await prisma.pass.create({ data: { code, kind: "GUEST", name: `${inq.name} (viewing with broker)`, unitId: inq.listing.unitId, userId: u.id, validFrom: new Date(slot.getTime() - 3600000), validTo: new Date(slot.getTime() + 3 * 3600000), note: `Unit viewing with ${BROKER.name}` } });
  await prisma.inquiry.update({ where: { id: inq.id }, data: { status: "VIEWING", viewingAt: slot, passCode: code } });
  await notifyUser(u.id, `Viewing booked for ${inq.listing.unit.code}`, `${inq.name} will view unit ${inq.listing.unit.code} on ${fmtDateTime(slot)} with ${BROKER.name}. The lobby guard has their pass (${code}). You don't need to be there.`, ["APP"]);
  await audit(u.id, "viewing booked", `${inq.listing.unit.code} ${inq.name} ${slot.toISOString()}`);
  revalidatePath(`/property/${inq.listingId}`);
  redirect(`/property/${inq.listingId}#inquiries`);
}
