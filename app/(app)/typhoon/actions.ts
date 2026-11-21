"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dispatch } from "@/lib/comms";
import { PREP, RESIDENT_TIP } from "@/lib/weather";
import { activeStorm } from "@/lib/typhoon";

/** One tap: storm record, prep work order for the team, and an urgent alert to every resident (app + SMS). */
export async function startTyphoon(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  if (await activeStorm()) redirect("/typhoon?error=" + encodeURIComponent("Typhoon mode is already on."));
  const name = String(fd.get("name") || "").trim().slice(0, 60) || "Typhoon";
  const storm = await prisma.stormEvent.create({ data: { name, createdBy: u.name } });
  const title = "Typhoon prep checklist";
  if (!(await prisma.workOrder.findFirst({ where: { title, status: { not: "DONE" } } }))) {
    const wo = await prisma.workOrder.create({ data: { title, location: "Building systems", category: "Mechanical", priority: "HIGH", slaHours: 12, source: "Typhoon mode", status: "ASSIGNED", assignee: "Engineering", description: PREP.storm.map((p, i) => `${i + 1}. [${p.who}] ${p.task}`).join("\n") } });
    await audit(u.id, "work_order", `Opened WO-${wo.number} ${title} (typhoon mode)`);
  }
  const tip = RESIDENT_TIP.storm!;
  const a = await prisma.announcement.create({ data: {
    kind: "URGENT", category: "Typhoon advisory", title: `${name}: typhoon mode is on`,
    bodyEn: `${name} is expected to bring strong winds and heavy rain to Makati.\n\n${tip.en}\n\nThe building team is fuelling the generator, testing the sump pumps and securing the pool deck. If you can, move cars from B2 to B1. After the storm we'll ask every unit to check in from the app.\n\nEmergency: guard house local 100, or SOS in the app. Stay safe po.`,
    bodyTl: `Inaasahang magdadala ang ${name} ng malakas na hangin at ulan sa Makati.\n\n${tip.tl}\n\nPinupuno na po ng building team ang generator, tine-test ang sump pumps at sinisigurado ang pool deck. Kung kaya, ilipat po ang kotse mula B2 papuntang B1. Pagkatapos ng bagyo, hihilingin naming mag-check in ang bawat unit sa app.\n\nEmergency: guard house local 100, o SOS sa app. Ingat po.`,
    smsEn: `Skyland: TYPHOON MODE ON for ${name}. ${tip.en}`.slice(0, 300), smsTl: `Skyland: TYPHOON MODE para sa ${name}. ${tip.tl}`.slice(0, 300),
    audience: "ALL", channels: ["APP", "SMS", "MESSENGER"], status: "SCHEDULED", createdBy: u.name, approvedBy: u.name,
  } });
  const r = await dispatch(a.id);
  await audit(u.id, "typhoon mode on", `${name}: alert to ${r.recipients ?? 0} owners`);
  revalidatePath("/typhoon");
  redirect("/typhoon?ok=" + encodeURIComponent(`Typhoon mode is on. Prep alert sent to ${r.recipients ?? 0} owners, and the prep checklist is assigned to Engineering.`));
}

/** After the storm: ask every unit to check in. */
export async function startCheckins() {
  const u = await requireRole("MANAGER", "ADMIN");
  const s = await activeStorm();
  if (!s) redirect("/typhoon");
  await prisma.stormEvent.update({ where: { id: s.id }, data: { phase: "CHECKIN", checkinAt: new Date() } });
  const a = await prisma.announcement.create({ data: {
    kind: "URGENT", category: "Post-storm check-in", title: `${s.name} has passed. Are you OK?`,
    bodyEn: "Please tap one button in the app so we know how you are: Safe, Damage in my unit, or I need help. It takes 5 seconds and helps us reach anyone who needs us first.",
    bodyTl: "Paki-tap po ang isang button sa app para malaman namin ang lagay ninyo: Ligtas, May sira sa unit, o Kailangan ko ng tulong. Limang segundo lang po.",
    smsEn: `Skyland: ${s.name} has passed. Are you OK? Open the app > Typhoon to check in (Safe / Damage / Need help).`, smsTl: `Skyland: Lumipas na ang ${s.name}. OK lang po ba kayo? Buksan ang app > Typhoon para mag-check in.`,
    audience: "ALL", channels: ["APP", "SMS", "MESSENGER"], status: "SCHEDULED", createdBy: u.name, approvedBy: u.name,
  } });
  const r = await dispatch(a.id);
  await audit(u.id, "storm check-ins started", `${s.name}: ${r.recipients ?? 0} owners asked`);
  revalidatePath("/typhoon");
  redirect("/typhoon?ok=" + encodeURIComponent(`Check-in request sent to ${r.recipients ?? 0} owners. Replies show on the grid as they come in.`));
}

export async function endTyphoon() {
  const u = await requireRole("MANAGER", "ADMIN");
  const s = await activeStorm();
  if (s) { await prisma.stormEvent.update({ where: { id: s.id }, data: { phase: "CLOSED", closedAt: new Date() } }); await audit(u.id, "typhoon mode off", s.name); }
  revalidatePath("/typhoon");
  redirect("/typhoon?ok=" + encodeURIComponent("Typhoon mode is off. The check-in record stays for the board report."));
}

/** Resident: Safe / Damage / Need help. A damage or help reply opens a ticket right away. */
export async function checkIn(fd: FormData) {
  const u = await requireRole("OWNER");
  const p = z.object({ status: z.enum(["OK", "DAMAGE", "HELP"]), note: z.string().trim().max(300).optional() }).safeParse(Object.fromEntries(fd));
  const s = await activeStorm();
  if (!p.success || !s) redirect("/typhoon");
  const units = await prisma.unit.findMany({ where: { ownerId: u.id } });
  for (const x of units) await prisma.stormCheckin.upsert({ where: { stormId_unitId: { stormId: s.id, unitId: x.id } }, update: { status: p.data.status, note: p.data.note || null, userId: u.id }, create: { stormId: s.id, unitId: x.id, unitCode: x.code, userId: u.id, status: p.data.status, note: p.data.note || null } });
  if (p.data.status !== "OK" && units[0]) {
    const help = p.data.status === "HELP";
    await prisma.workOrder.create({ data: { title: help ? `Storm: resident needs help in ${units[0].code}` : `Storm damage in ${units[0].code}`, description: p.data.note || (help ? "Resident asked for help after the storm." : "Resident reported damage after the storm."), category: help ? "Security" : "Civil", priority: "HIGH", slaHours: help ? 1 : 12, location: units[0].code, unitId: units[0].id, source: "Typhoon check-in", reporterId: u.id, status: help ? "ESCALATED" : "NEW" } });
  }
  await audit(u.id, "storm check-in", `${s.name}: ${p.data.status}`);
  revalidatePath("/typhoon");
  redirect("/typhoon?ok=" + encodeURIComponent(p.data.status === "OK" ? "Salamat po! Glad you're safe." : p.data.status === "HELP" ? "Help is on the way. The guard and manager have been alerted. If it's life-threatening, call 911." : "Got it. We've opened a repair ticket and will inspect today."));
}
