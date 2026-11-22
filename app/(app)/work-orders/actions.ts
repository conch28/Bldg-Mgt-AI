"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { photoOk } from "@/lib/image";
import { photoSig } from "@/lib/photosig";
import { notifyUser } from "@/lib/comms";

const SLA = { HIGH: 4, MEDIUM: 24, LOW: 72 } as const;
const newJobToken = async () => randomBytes(18).toString("base64url");
const back = (fd: FormData, q = "") => { const b = String(fd.get("back") || "/work-orders"); return (b.startsWith("/") ? b : "/work-orders") + q; };
const fail = (fd: FormData, msg: string) => redirect(back(fd, (back(fd).includes("?") ? "&" : "?") + "error=" + encodeURIComponent(msg)));

export async function updateWorkOrder(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const p = z.object({ id: z.string(), status: z.enum(["NEW", "ASSIGNED", "IN_PROGRESS", "ESCALATED", "DONE"]), assignee: z.string().max(80).optional(), note: z.string().max(1000).optional() }).parse(Object.fromEntries(fd));
  const before = await prisma.workOrder.findUniqueOrThrow({ where: { id: p.id } });
  // Closing needs proof of the finished work: the technician's job link or "Close with photo".
  if (p.status === "DONE" && before.status !== "DONE" && !before.donePhoto) return fail(fd, `WO-${before.number}: close it with an after photo (tap "Close with photo"), or send the job link to the technician.`);
  const changes: string[] = [];
  if (before.status !== p.status) changes.push(`status ${before.status} → ${p.status}`);
  if ((p.assignee ?? "") !== (before.assignee ?? "")) changes.push(`assigned to ${p.assignee || "nobody"}`);
  const ack = !before.ackAt && (p.status !== "NEW" || p.assignee);
  await prisma.workOrder.update({ where: { id: p.id }, data: {
    status: p.status, assignee: p.assignee || null, closedAt: p.status === "DONE" ? before.closedAt ?? new Date() : null,
    ...(ack ? { ackAt: new Date(), ackBy: u.name } : {}),
    ...(p.assignee && !before.jobToken ? { jobToken: await newJobToken() } : {}),
    ...(p.status !== "DONE" && before.status === "DONE" ? { verifiedAt: null, verifiedBy: null } : {}),
    events: changes.length || p.note ? { create: { note: [changes.join(", "), p.note].filter(Boolean).join(". "), author: u.name } } : undefined,
  } });
  if (changes.length) await audit(u.id, "work_order", `WO-${before.number} ${before.title}: ${changes.join(", ")}`);
  revalidatePath("/work-orders"); revalidatePath("/tasks");
}

/** Walk-ins and calls: the front desk or manager logs it as a ticket on the spot. */
export async function createWorkOrder(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN", "GUARD");
  const p = z.object({ title: z.string().min(3).max(120), location: z.string().min(1).max(60), category: z.string().min(1).max(40), priority: z.enum(["LOW", "MEDIUM", "HIGH"]), assignee: z.string().max(80).optional(), source: z.string().max(40).optional(), detail: z.string().max(1000).optional(), photo: z.string().optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(fd, "Say what's wrong (at least 3 letters) and where.");
  if (p.data.photo && !photoOk(p.data.photo)) return fail(fd, "That photo couldn't be used. Try again.");
  const unit = await prisma.unit.findFirst({ where: { code: p.data.location.toUpperCase() } });
  const isMgr = u.role !== "GUARD";
  const assignee = isMgr ? p.data.assignee || null : null;
  const wo = await prisma.workOrder.create({ data: { title: p.data.title, description: p.data.detail || null, location: unit?.code ?? p.data.location, unitId: unit?.id, category: p.data.category, priority: p.data.priority, slaHours: SLA[p.data.priority], assignee, status: assignee ? "ASSIGNED" : "NEW", source: p.data.source || "Walk-in",
    photo: p.data.photo || null, ...(assignee ? { ackAt: new Date(), ackBy: u.name, jobToken: await newJobToken() } : {}),
    events: { create: { note: `Logged by ${u.name} (${p.data.source || "walk-in"}).`, author: u.name } } } });
  await audit(u.id, "work_order", `Opened WO-${wo.number}: ${wo.title} (${wo.location}), source ${wo.source}`);
  if (!isMgr) { const mgrs = await prisma.user.findMany({ where: { role: "MANAGER", active: true }, select: { id: true } }); await Promise.all(mgrs.map((m) => notifyUser(m.id, `New ticket WO-${wo.number}`, `${wo.title} at ${wo.location}, logged by ${u.name} at the front desk. Acknowledge within the hour.`, ["APP"]))); }
  revalidatePath("/work-orders"); revalidatePath("/tasks");
  redirect(back(fd, (back(fd).includes("?") ? "&" : "?") + "ok=" + encodeURIComponent(`Logged as WO-${wo.number}. The manager has it.`)));
}

/** Manager closes a job on the technician's behalf; the after photo is still required. */
export async function closeWithPhoto(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const id = String(fd.get("id") || ""), photo = String(fd.get("photo") || "");
  const note = String(fd.get("note") || "").trim().slice(0, 600), by = String(fd.get("doneBy") || "").trim().slice(0, 80);
  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id } });
  if (!photo) return fail(fd, `WO-${wo.number}: take a photo of the finished work first.`);
  if (!photoOk(photo)) return fail(fd, "That photo couldn't be used. Try again.");
  const doneBy = by || wo.assignee || u.name;
  await prisma.workOrder.update({ where: { id }, data: { status: "DONE", closedAt: wo.closedAt ?? new Date(), donePhoto: photo, donePhotoSig: photoSig(photo), doneNote: note || null, doneBy, ackAt: wo.ackAt ?? new Date(), ackBy: wo.ackBy ?? u.name,
    events: { create: { note: `Marked done by ${u.name} for ${doneBy}, with after photo.${note ? " " + note : ""}`, author: u.name } } } });
  await audit(u.id, "work_order", `WO-${wo.number} closed with photo (done by ${doneBy})`);
  revalidatePath("/work-orders"); revalidatePath("/tasks");
  redirect(back(fd, (back(fd).includes("?") ? "&" : "?") + "ok=" + encodeURIComponent(`WO-${wo.number} is done. Verify it within 24 hours.`)));
}

/** The second check: the manager confirms the fix (or sends it back), then the resident is asked to rate it. */
export async function verifyWorkOrder(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const id = String(fd.get("id") || ""), ok = fd.get("decision") !== "reject";
  const note = String(fd.get("note") || "").trim().slice(0, 600);
  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id } });
  if (wo.status !== "DONE") return fail(fd, `WO-${wo.number} isn't marked done yet.`);
  if (ok) {
    await prisma.workOrder.update({ where: { id }, data: { verifiedAt: new Date(), verifiedBy: u.name, events: { create: { note: `Verified by ${u.name}.${note ? " " + note : ""}`, author: u.name } } } });
    await audit(u.id, "work_order", `WO-${wo.number} verified`);
    if (wo.reporterId) await notifyUser(wo.reporterId, `Fixed: ${wo.title}`, `Your request WO-${wo.number} is done and checked by the property manager. Paki-rate po ang serbisyo sa app (1 tap). Salamat po!`, ["APP"]);
  } else {
    if (!note) return fail(fd, `WO-${wo.number}: say what still needs fixing.`);
    await prisma.workOrder.update({ where: { id }, data: { status: "IN_PROGRESS", closedAt: null, donePhoto: null, donePhotoSig: null, verifiedAt: null, verifiedBy: null, events: { create: { note: `Sent back by ${u.name}: ${note}`, author: u.name } } } });
    await audit(u.id, "work_order", `WO-${wo.number} sent back: ${note}`);
  }
  revalidatePath("/work-orders"); revalidatePath("/tasks");
  redirect(back(fd, (back(fd).includes("?") ? "&" : "?") + "ok=" + encodeURIComponent(ok ? `WO-${wo.number} verified. The resident will be asked to rate it.` : `WO-${wo.number} sent back to the technician.`)));
}

export async function makeJobLink(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const id = String(fd.get("id") || "");
  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id } });
  if (!wo.jobToken) await prisma.workOrder.update({ where: { id }, data: { jobToken: await newJobToken() } });
  await audit(u.id, "work_order", `WO-${wo.number}: job link created`);
  revalidatePath("/work-orders");
}
