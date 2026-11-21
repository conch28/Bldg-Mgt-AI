"use server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/lib/comms";

const PATH = "/admin/system";

/** Close a privacy request with a reply the person sees under Account → Your data. */
export async function closeRequest(fd: FormData) {
  const a = await requireRole("ADMIN");
  const p = z.object({ id: z.string(), status: z.enum(["DONE", "DECLINED"]), reply: z.string().trim().min(2).max(500) }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect(PATH + "?error=reply");
  const r = await prisma.privacyRequest.update({ where: { id: p.data.id }, data: { status: p.data.status, reply: p.data.reply, closedAt: new Date() } });
  await audit(a.id, "privacy_request_closed", `${r.kind} ${p.data.status.toLowerCase()}: ${p.data.reply}`);
  await notifyUser(r.userId, "Your privacy request", p.data.reply, ["APP", "EMAIL"]);
  revalidatePath(PATH);
}

/**
 * Right to erasure. Removes what identifies the person and what they wrote; keeps billing rows
 * (required by tax rules) with the name removed. Cannot be undone.
 */
export async function eraseUser(fd: FormData) {
  const a = await requireRole("ADMIN");
  const p = z.object({ requestId: z.string(), confirm: z.literal("DELETE") }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect(PATH + "?error=confirm");
  const req = await prisma.privacyRequest.findUniqueOrThrow({ where: { id: p.data.requestId }, include: { user: true } });
  const id = req.userId;
  if (id === a.id) redirect(PATH + "?error=self");
  const listings = await prisma.listing.findMany({ where: { userId: id }, select: { id: true } });
  await prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { userId: id } }),
    prisma.loginCode.deleteMany({ where: { userId: id } }),
    prisma.inquiry.deleteMany({ where: { listingId: { in: listings.map((l) => l.id) } } }),
    prisma.listing.updateMany({ where: { userId: id }, data: { status: "WITHDRAWN", title: "Removed", body: "Removed at the owner's request", bodyTl: null, highlights: [] } }),
    prisma.marketItem.updateMany({ where: { userId: id }, data: { status: "REMOVED", title: "Removed", description: "Removed" } }),
    prisma.lostFound.updateMany({ where: { userId: id }, data: { title: "Removed", description: null, status: "RETURNED" } }),
    prisma.pulse.updateMany({ where: { userId: id }, data: { comment: null } }),
    prisma.pass.updateMany({ where: { userId: id }, data: { name: "Removed", plate: null, note: null, validTo: new Date() } }),
    prisma.registration.updateMany({ where: { userId: id }, data: { name: "Removed", details: "Removed" } }),
    prisma.unit.updateMany({ where: { ownerId: id }, data: { ownerId: null, ownerName: null } }),
    prisma.user.update({ where: { id }, data: {
      name: "Former resident", email: `erased-${id}@erased.invalid`, phone: null, messengerPsid: null, active: false, consentAt: null,
      passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10), notifySms: false, notifyEmail: false, notifyMessenger: false,
    } }),
    prisma.privacyRequest.update({ where: { id: req.id }, data: { status: "DONE", reply: "Your personal data was deleted. Billing records are kept without your name, as tax rules require.", closedAt: new Date() } }),
  ]);
  await audit(a.id, "privacy_erasure", `Erased personal data of a former ${req.user.role.toLowerCase()} account (request ${req.id})`);
  revalidatePath(PATH);
  redirect(PATH + "?erased=1");
}
