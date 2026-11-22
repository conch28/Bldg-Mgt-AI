"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { photoOk } from "@/lib/image";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { notifyUser } from "@/lib/comms";

/** Technician job link actions. The unguessable token in the link is the only credential, so each action is narrow. */
async function load(fd: FormData) {
  const token = String(fd.get("token") || "").slice(0, 64);
  const ip = clientIp(headers() as any);
  const rl = await rateLimit(`job:${ip}`, 40, 900);
  if (!rl.ok) redirect(`/j/${token}?error=` + encodeURIComponent("Too many tries. Wait a few minutes."));
  const wo = token ? await prisma.workOrder.findUnique({ where: { jobToken: token } }) : null;
  if (!wo) redirect(`/j/${token}`);
  return { token, wo: wo! };
}
const back = (token: string, q: string) => redirect(`/j/${token}?${q}`);
const tellManagers = async (title: string, body: string) => {
  const m = await prisma.user.findMany({ where: { role: "MANAGER", active: true }, select: { id: true } });
  await Promise.all(m.map((x) => notifyUser(x.id, title, body, ["APP"])));
};

export async function jobStart(fd: FormData) {
  const { token, wo } = await load(fd);
  if (wo.status === "DONE") return back(token, "");
  const who = String(fd.get("name") || "").trim().slice(0, 80) || wo.assignee || "Technician";
  await prisma.workOrder.update({ where: { id: wo.id }, data: { status: "IN_PROGRESS", ackAt: wo.ackAt ?? new Date(), ackBy: wo.ackBy ?? who, events: { create: { note: `${who} started work (job link).`, author: who } } } });
  await prisma.auditLog.create({ data: { action: "work_order", detail: `WO-${wo.number} started by ${who} via job link` } });
  back(token, "ok=" + encodeURIComponent("Started. Take an after photo when you finish."));
}

export async function jobDone(fd: FormData) {
  const { token, wo } = await load(fd);
  if (wo.status === "DONE") return back(token, "");
  const photo = String(fd.get("photo") || "");
  const note = String(fd.get("note") || "").trim().slice(0, 600);
  const who = String(fd.get("name") || "").trim().slice(0, 80) || wo.assignee || "Technician";
  if (!photo) return back(token, "error=" + encodeURIComponent("Take a photo of the finished work first."));
  if (!photoOk(photo)) return back(token, "error=" + encodeURIComponent("That photo couldn't be used. Try again."));
  await prisma.workOrder.update({ where: { id: wo.id }, data: { status: "DONE", closedAt: new Date(), donePhoto: photo, doneNote: note || null, doneBy: who, ackAt: wo.ackAt ?? new Date(), ackBy: wo.ackBy ?? who,
    events: { create: { note: `Done, with after photo (job link).${note ? " " + note : ""}`, author: who } } } });
  await prisma.auditLog.create({ data: { action: "work_order", detail: `WO-${wo.number} marked done by ${who} via job link, with photo` } });
  await tellManagers(`WO-${wo.number} done: please verify`, `${who} finished "${wo.title}" at ${wo.location} and sent an after photo. Verify within 24 hours.`);
  back(token, "ok=" + encodeURIComponent("Salamat po! The manager will check it."));
}

export async function jobBlocked(fd: FormData) {
  const { token, wo } = await load(fd);
  const note = String(fd.get("note") || "").trim().slice(0, 600);
  const who = String(fd.get("name") || "").trim().slice(0, 80) || wo.assignee || "Technician";
  if (!note) return back(token, "error=" + encodeURIComponent("Say what's stopping you (e.g. need a part, no access to the unit)."));
  await prisma.workOrder.update({ where: { id: wo.id }, data: { events: { create: { note: `Can't finish yet: ${note}`, author: who } } } });
  await prisma.auditLog.create({ data: { action: "work_order", detail: `WO-${wo.number}: ${who} reported a blocker: ${note}` } });
  await tellManagers(`WO-${wo.number} is blocked`, `${who}: ${note}`);
  back(token, "ok=" + encodeURIComponent("Sent to the manager."));
}
