"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PREP, RESIDENT_TIP, dayWord } from "@/lib/weather";

const riskOf = (fd: FormData) => { const r = String(fd.get("risk")); return r === "storm" || r === "rain" || r === "heat" ? r : null; };

/** One work order holding the prep checklist, so it has an owner, a deadline and shows on Today. */
export async function openPrepTicket(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const risk = riskOf(fd); if (!risk) return;
  const title = risk === "storm" ? "Typhoon prep checklist" : risk === "rain" ? "Heavy-rain prep checklist" : "Heat prep checklist";
  const existing = await prisma.workOrder.findFirst({ where: { title, status: { not: "DONE" } } });
  if (!existing) {
    const wo = await prisma.workOrder.create({ data: {
      title, location: "Building systems", category: "Mechanical", priority: risk === "storm" ? "HIGH" : "MEDIUM", slaHours: risk === "storm" ? 12 : 24,
      source: "Weather", status: "ASSIGNED", assignee: "Engineering",
      description: PREP[risk].map((p, i) => `${i + 1}. [${p.who}] ${p.task}`).join("\n"),
      events: { create: { note: `Opened from the weather forecast by ${u.name}.`, author: u.name } },
    } });
    await audit(u.id, "work_order", `Opened WO-${wo.number} ${title} from the forecast`);
  }
  revalidatePath("/today"); revalidatePath("/advisor");
  redirect("/work-orders");
}

/** Drafts the resident advisory in English and Taglish. It waits in Resident updates for the manager to approve. */
export async function draftStormAdvisory(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const risk = riskOf(fd); if (!risk || risk === "heat") return;
  const day = String(fd.get("day") || "");
  const when = /^\d{4}-\d{2}-\d{2}$/.test(day) ? dayWord(day) : "soon";
  const tip = RESIDENT_TIP[risk]!;
  const storm = risk === "storm";
  const title = storm ? `Typhoon advisory: strong winds and heavy rain ${when}` : `Heavy rain expected ${when}`;
  const bodyEn = `${storm ? "Strong winds and heavy rain" : "Heavy rain"} ${when === "soon" ? "are expected soon" : `are expected ${when}`} in Makati, based on the latest forecast.\n\n${tip.en}\n\nThe building team is clearing drains, testing the sump pumps${storm ? ", fuelling the generator and securing the pool deck" : ""}. If water enters your unit, call the admin office or use SOS in the app.\n\nPlease follow PAGASA and Makati DRRMO announcements. Stay safe po.`;
  const bodyTl = `${storm ? "Malakas na hangin at ulan" : "Malakas na ulan"} ang inaasahan ${when === "today" ? "ngayong araw" : when === "tomorrow" ? "bukas" : when} sa Makati, ayon sa pinakabagong forecast.\n\n${tip.tl}\n\nNililinis na po ng building team ang mga drain at tine-test ang sump pumps${storm ? ", pinupuno ang generator at sinisigurado ang pool deck" : ""}. Kung may pumasok na tubig sa unit, tumawag po sa admin office o gamitin ang SOS sa app.\n\nSundan po ang anunsyo ng PAGASA at Makati DRRMO. Ingat po tayong lahat.`;
  const smsEn = `Skyland: ${storm ? "Typhoon" : "Heavy rain"} ${when}. ${tip.en}`.slice(0, 300);
  const smsTl = `Skyland: ${storm ? "Bagyo" : "Malakas na ulan"} ${when === "tomorrow" ? "bukas" : when}. ${tip.tl}`.slice(0, 300);
  const a = await prisma.announcement.create({ data: { kind: storm ? "URGENT" : "ROUTINE", category: storm ? "Typhoon advisory" : "Weather advisory", title, bodyEn, bodyTl, smsEn, smsTl, audience: "ALL", channels: ["APP", "SMS"], status: "PENDING_APPROVAL", aiDrafted: true, createdBy: u.name } });
  await audit(u.id, "announcement drafted", title);
  redirect("/comms?edit=" + a.id);
}
