/**
 * Things the AI helper can do for an owner: file a repair, issue a guest / parking / delivery / contractor pass,
 * and book an amenity. The AI only drafts an action; nothing happens until the owner checks the details and taps
 * Confirm (app/(app)/ask/actions.ts → runAction). The same functions back the normal Passes and Amenities forms,
 * so the rules are identical whichever way a resident asks.
 */
import { randomInt } from "crypto";
import { z } from "zod";
import { prisma } from "./db";
import { audit, type SessionUser } from "./auth";
import { nowManila, fmtDateTime, fmtDate, TZ } from "./format";
import { notifyUser } from "./comms";
import { SLA_HOURS } from "./rounds";

export const PASS_KINDS = { GUEST: "Guest", PARKING: "Guest parking", DELIVERY: "Delivery", CONTRACTOR: "Contractor / worker", MOVE: "Move in / move out", STAY: "Short-stay guest (Airbnb)" } as const;
export type PassKind = keyof typeof PASS_KINDS;
export const REPAIR_CATEGORIES = ["Plumbing", "Electrical", "Civil", "Mechanical", "Elevator", "Security", "Housekeeping", "Other"] as const;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("repair"), title: z.string().trim().min(3).max(120), description: z.string().trim().max(2000).default(""), category: z.enum(REPAIR_CATEGORIES).default("Other"), priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"), location: z.string().trim().max(60).default("") }),
  z.object({ type: z.literal("pass"), kind: z.enum(["GUEST", "PARKING", "DELIVERY", "CONTRACTOR"]), name: z.string().trim().max(80).default(""), date: ymd, days: z.coerce.number().int().min(1).max(30).default(1), plate: z.string().trim().max(12).default(""), note: z.string().trim().max(200).default("") }),
  z.object({ type: z.literal("amenity"), amenityId: z.string().default(""), date: ymd, hour: z.coerce.number().int().min(0).max(23), guests: z.coerce.number().int().min(0).max(80).default(0) }),
]);
export type Action = z.infer<typeof ActionSchema>;
export type ActionResult = { ok: true; message: string; href: string; ref: string } | { ok: false; error: string };
export type AmenityOption = { id: string; name: string; openHour: number; closeHour: number; slotHours: number; capacity: number; fee: number };

export const todayManila = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(nowManila());
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => ALPHA[randomInt(ALPHA.length)]).join("");
const ownerUnit = (userId: string) => prisma.unit.findFirst({ where: { ownerId: userId }, orderBy: { code: "asc" } });

export async function amenityOptions(): Promise<AmenityOption[]> {
  const a = await prisma.amenity.findMany({ orderBy: { name: "asc" } });
  return a.map((x) => ({ id: x.id, name: x.name, openHour: x.openHour, closeHour: x.closeHour, slotHours: x.slotHours, capacity: x.capacity, fee: Number(x.fee) }));
}

/** Files a repair ticket for the owner's unit (or the common area they name). */
export async function fileRepair(user: SessionUser, a: Extract<Action, { type: "repair" }>, source = "Ask AI"): Promise<ActionResult> {
  const units = await prisma.unit.findMany({ where: { ownerId: user.id } });
  const loc = a.location || units[0]?.code || "Common area";
  const hours = SLA_HOURS[a.priority];
  const wo = await prisma.workOrder.create({ data: {
    title: a.title, description: a.description || null, category: a.category, priority: a.priority, slaHours: hours, location: loc,
    unitId: units.find((u) => u.code === loc)?.id ?? null, source, reporterId: user.id,
    events: { create: { note: `Filed by ${user.name} through the AI helper after confirming the details. Priority ${a.priority.toLowerCase()} (${hours}h deadline).`, author: "AI helper" } },
  } });
  await audit(user.id, "work_order", `Opened WO-${wo.number} from the AI helper: ${a.title}`);
  return { ok: true, ref: `WO-${wo.number}`, href: "/my", message: `Done po! Ticket **WO-${wo.number}** is filed (${a.category}, ${a.priority.toLowerCase()} priority). A technician should be there within ${hours} hours. You can follow it on the My unit page.` };
}

/** Issues a pass the guard can scan. Same checks as the Passes page. */
export async function issuePass(user: SessionUser, p: { kind: PassKind; name: string; date: string; days: number; plate?: string; note?: string; photo?: string | null }): Promise<ActionResult & { id?: string }> {
  if (p.name.trim().length < 2) return { ok: false, error: "Please add the visitor's or courier's name." };
  if (p.kind === "PARKING" && !p.plate?.trim()) return { ok: false, error: "A guest parking pass needs the plate number." };
  const unit = await ownerUnit(user.id);
  if (!unit) return { ok: false, error: "No unit is linked to your account yet. Please message the helpdesk." };
  const validFrom = new Date(`${p.date}T00:00:00+08:00`);
  if (isNaN(validFrom.getTime()) || validFrom.getTime() < nowManila().getTime() - 86400000) return { ok: false, error: "Pick today or a future date." };
  if (p.kind === "STAY" && (validFrom.getTime() - nowManila().getTime() < 86400000 - 12 * 3600000 || p.days < 2)) return { ok: false, error: "Short stays need 2 nights or more, registered at least a day ahead." };
  let code = newCode();
  while (await prisma.pass.findUnique({ where: { code } })) code = newCode();
  const note = [p.kind === "PARKING" ? "Guest parking" : "", p.note ?? ""].filter(Boolean).join(" · ") || null;
  const pass = await prisma.pass.create({ data: { code, kind: p.kind, name: p.name.trim(), plate: p.plate?.trim().toUpperCase() || null, unitId: unit.id, userId: user.id, validFrom, validTo: new Date(validFrom.getTime() + p.days * 86400000 - 1), note, photo: p.photo ?? null } });
  await audit(user.id, "pass created", `${pass.kind} ${pass.name} for ${unit.code}`);
  const span = p.days > 1 ? `${fmtDate(pass.validFrom)} to ${fmtDate(pass.validTo)}` : fmtDate(pass.validFrom);
  return { ok: true, id: pass.id, ref: code, href: "/passes?new=" + pass.id, message: `All set po! ${PASS_KINDS[p.kind]} pass **${code}** for ${pass.name}${pass.plate ? ` (${pass.plate})` : ""}, valid ${span}. Send the code to your visitor; the guard scans it at the lobby.` };
}

/** Books an amenity slot. Same checks as the Amenities page. */
export async function bookSlot(user: SessionUser, p: { amenityId: string; date: string; hour: number; guests: number }): Promise<ActionResult> {
  const [unit, a] = await Promise.all([ownerUnit(user.id), p.amenityId ? prisma.amenity.findUnique({ where: { id: p.amenityId } }) : null]);
  if (!unit) return { ok: false, error: "No unit is linked to your account yet. Please message the helpdesk." };
  if (!a) return { ok: false, error: "Please pick an amenity." };
  const start = new Date(`${p.date}T${String(p.hour).padStart(2, "0")}:00:00+08:00`);
  const end = new Date(start.getTime() + a.slotHours * 3600000);
  const dow = new Date(`${p.date}T12:00:00+08:00`).getUTCDay();
  if (isNaN(start.getTime()) || start < nowManila()) return { ok: false, error: "Please pick a time in the future." };
  if (a.closedDow === dow) return { ok: false, error: `${a.name} is closed that day.` };
  if (p.hour < a.openHour || p.hour + a.slotHours > a.closeHour) return { ok: false, error: `${a.name} is open ${a.openHour}:00 to ${a.closeHour}:00.` };
  if (p.guests + 1 > a.capacity) return { ok: false, error: `${a.name} fits up to ${a.capacity} people.` };
  const overdue = await prisma.bill.count({ where: { unitId: unit.id, status: { not: "PAID" }, dueDate: { lt: new Date(nowManila().getTime() - 60 * 86400000) } } });
  if (overdue) return { ok: false, error: "Amenity booking is paused for accounts over 60 days late (House Rules §7.3). Please settle your dues first, or message the helpdesk." };
  // capacity-based amenities (gym, pool) allow overlapping bookings until full; exclusive ones (function room, court) allow one
  const exclusive = /court|room|grill|karaoke|lounge/i.test(a.name);
  const clash = await prisma.amenityBooking.findMany({ where: { amenityId: a.id, status: "CONFIRMED", start: { lt: end }, end: { gt: start } } });
  if (exclusive && clash.length) return { ok: false, error: `${a.name} is already booked at that time. Try another slot.` };
  if (!exclusive && clash.reduce((s, b) => s + b.guests + 1, 0) + p.guests + 1 > a.capacity) return { ok: false, error: `${a.name} is full at that time.` };
  const b = await prisma.amenityBooking.create({ data: { amenityId: a.id, unitId: unit.id, userId: user.id, start, end, guests: p.guests } });
  await audit(user.id, "amenity booking", `Unit ${unit.code} booked ${a.name} ${fmtDateTime(start)}`);
  const fee = Number(a.fee);
  await notifyUser(user.id, `Booked: ${a.name}`, `Your booking for ${a.name} on ${fmtDateTime(start)} is confirmed${fee ? `. A fee of ₱${fee.toLocaleString()} will appear on your next statement` : ""}. Show this message at the front desk.`, ["APP"]);
  return { ok: true, ref: b.id, href: "/amenities", message: `Booked po! **${a.name}**, ${fmtDateTime(b.start)}${p.guests ? ` for you + ${p.guests}` : ""}.${fee ? ` ₱${fee.toLocaleString()} goes on your next statement.` : ""} See you there! 🎉` };
}

export async function runAction(user: SessionUser, raw: unknown): Promise<ActionResult> {
  const p = ActionSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "Some details are missing. Please check the form." };
  const a = p.data;
  if (a.type === "repair") return fileRepair(user, a);
  if (a.type === "pass") return issuePass(user, { kind: a.kind, name: a.name, date: a.date, days: a.days, plate: a.plate, note: a.note });
  return bookSlot(user, a);
}

/* ---------------- Spotting a request without AI (no-key fallback) ---------------- */

const has = (t: string, words: string[]) => words.some((w) => t.includes(w));
const DO = ["book", "request", "reserve", "need a", "i need", "can you", "pa-book", "pa book", "pabook", "ipa", "pakigawa", "gawan", "file", "report", "create", "make", "get me", "magpa", "pa-reserve", "paki", "want a", "i'd like", "schedule"];

/** Next date mentioned ("tomorrow", "bukas", "saturday", "2026-12-05"), else today. */
function dateIn(t: string): string {
  const today = new Date(`${todayManila()}T12:00:00+08:00`);
  const iso = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const add = (n: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(today.getTime() + n * 86400000));
  if (/\b(tomorrow|bukas)\b/.test(t)) return add(1);
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const i = days.findIndex((d) => t.includes(d));
  if (i >= 0) return add(((i - today.getUTCDay() + 7) % 7) || 7);
  return add(0);
}
function hourIn(t: string): number | null {
  const m = t.match(/\b(\d{1,2})(?::00)?\s*(am|pm|n\.?n\.?)\b/);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[2] === "pm") h += 12;
  return h;
}

/** Turns "pa-book ng function room bukas 3pm" into a draft the owner can check. Null when it's not a request. */
export function guessAction(q: string, amenities: AmenityOption[]): Action | null {
  const t = " " + q.toLowerCase() + " ";
  const date = dateIn(t);
  const plate = q.match(/\b([A-Z]{2,3}[\s-]?\d{3,4})\b/i)?.[1]?.toUpperCase().replace("-", " ") ?? "";
  const wants = has(t, DO);
  if (has(t, ["parking pass", "guest parking", "visitor parking", "parking for my guest", "parking ng bisita"]) && (wants || t.includes("pass"))) return { type: "pass", kind: "PARKING", name: "", date, days: 1, plate, note: "" };
  if (has(t, ["delivery pass", "courier pass", "lalamove pass", "delivery rider"]) && (wants || t.includes("pass"))) return { type: "pass", kind: "DELIVERY", name: "", date, days: 1, plate: "", note: "" };
  if (has(t, ["contractor pass", "worker pass", "pass for my contractor", "pass for my worker"])) return { type: "pass", kind: "CONTRACTOR", name: "", date, days: 1, plate: "", note: "" };
  if (has(t, ["guest pass", "visitor pass", "pass for my guest", "pass for my visitor", "pass ng bisita", "gate pass for"]) || (wants && has(t, [" guest ", " bisita ", " visitor "]) && t.includes("pass"))) return { type: "pass", kind: "GUEST", name: "", date, days: 1, plate, note: "" };
  const am = amenities.find((a) => t.includes(a.name.toLowerCase()) || a.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && t.includes(` ${w} `)));
  if (am && has(t, ["book", "reserve", "booking", "pa-book", "pa book", "pabook", "pa-reserve"])) return { type: "amenity", amenityId: am.id, date, hour: hourIn(t) ?? Math.max(am.openHour, 10), guests: Number(t.match(/(\d+)\s*(guests|bisita|people|tao)/)?.[1] ?? 0) };
  const broken = ["leak", "tulo", "broken", "sira", "not working", "ayaw gumana", "clogged", "barado", "no water", "walang tubig", "no power", "brownout sa unit", "aircon", "repair", "ayusin", "fix my", "fix the", "technician"];
  if (has(t, broken) && (wants || has(t, ["repair", "ayusin", "fix", "technician", "please"]))) {
    const cat = has(t, ["leak", "tulo", "water", "tubig", "clogged", "barado", "toilet", "inidoro", "faucet", "gripo", "drain"]) ? "Plumbing"
      : has(t, ["power", "kuryente", "outlet", "light", "ilaw", "breaker", "switch"]) ? "Electrical" : has(t, ["aircon", "ac ", "exhaust", "fan"]) ? "Mechanical"
      : has(t, ["elevator", "lift", "elevador"]) ? "Elevator" : has(t, ["door", "pinto", "lock", "wall", "ceiling", "kisame", "tile"]) ? "Civil" : "Other";
    const high = has(t, ["leak", "tulo", "no water", "walang tubig", "no power", "spark", "smoke", "elevator", "flood", "baha"]);
    const generic = /^(report|file|book|request)( a)? (repair|problem)$/i.test(q.trim());
    return { type: "repair", title: generic ? "" : q.replace(/\s+/g, " ").trim().slice(0, 80), description: generic ? "" : q.trim(), category: cat, priority: high ? "HIGH" : "MEDIUM", location: "" };
  }
  return null;
}
