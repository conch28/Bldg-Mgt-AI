"use server";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readRepairPhoto, REPAIR_CATEGORIES } from "@/lib/ai";
import { rateLimit } from "@/lib/ratelimit";

const SLA = { HIGH: 4, MEDIUM: 24, LOW: 72 } as const;
const DataUrl = z.string().max(1_600_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/);

export async function analyzePhoto(photo: string, caption: string) {
  const u = await requireRole("OWNER");
  const rl = await rateLimit(`photo:${u.id}`, 20, 3600);
  if (!rl.ok) throw new Error("Too many photos in an hour. Please try again later.");
  return readRepairPhoto(DataUrl.parse(photo), z.string().max(300).parse(caption ?? ""));
}

export async function submitPhotoTicket(input: { photo: string; title: string; category: string; priority: "LOW" | "MEDIUM" | "HIGH"; location: string; note: string; seen: string; ai: boolean }) {
  const u = await requireRole("OWNER");
  const p = z.object({
    photo: DataUrl, title: z.string().min(3).max(120), category: z.enum(REPAIR_CATEGORIES), priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
    location: z.string().min(1).max(60), note: z.string().max(1000), seen: z.string().max(500), ai: z.boolean(),
  }).parse(input);
  const mine = await prisma.unit.findMany({ where: { ownerId: u.id } });
  const unit = mine.find((x) => x.code === p.location);
  // owners can report their own units or common areas, not someone else's unit
  if (!unit && /^\d+[A-Z]$/i.test(p.location)) throw new Error("Please choose your unit or a common area.");
  const wo = await prisma.workOrder.create({ data: {
    title: p.title, description: p.note || null, category: p.category, priority: p.priority, slaHours: SLA[p.priority],
    location: unit?.code ?? p.location, unitId: unit?.id ?? null, source: "Photo", reporterId: u.id, photo: p.photo, aiNote: p.seen || null,
    events: { create: { note: `Opened from a resident photo. ${p.ai ? "AI read the photo and" : "The resident"} set priority ${p.priority.toLowerCase()} (${SLA[p.priority]}h deadline).`, author: p.ai ? "AI photo triage" : u.name } },
  } });
  await audit(u.id, "work_order", `Opened WO-${wo.number} from a photo: ${wo.title} (${wo.location})`);
  return { number: wo.number, sla: SLA[p.priority] };
}
