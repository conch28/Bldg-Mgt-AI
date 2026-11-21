/**
 * Claude integration: owner helpdesk (tool use against our own database),
 * monthly board report, and collection reminders.
 *
 * Uses the Messages API with a manual tool loop because the tools are
 * database operations this app owns. With no ANTHROPIC_API_KEY set, every
 * function falls back to deterministic templates so the app still works.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam, BetaTool, BetaToolResultBlockParam, BetaToolUseBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { prisma } from "./db";
import { peso, fmtDate, monthLong, currentPeriod, nowManila } from "./format";
import { budgetFor, collectionTrend, overdueAccounts, slaStats } from "./metrics";
import type { SessionUser } from "./auth";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);
let _client: Anthropic | null = null;
const client = () => (_client ??= new Anthropic());

async function ask(params: { system: string; messages: BetaMessageParam[]; tools?: BetaTool[]; effort?: "low" | "medium" | "high"; max_tokens?: number }) {
  return client().beta.messages.create({
    model: MODEL,
    max_tokens: params.max_tokens ?? 16000,
    system: params.system,
    messages: params.messages,
    tools: params.tools,
    output_config: { effort: params.effort ?? "low" },
    // Server-side refusal fallback: if the model declines, the API reroutes to a suitable model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as any) as Promise<Anthropic.Beta.Messages.BetaMessage>;
}
const textOf = (m: Anthropic.Beta.Messages.BetaMessage) => m.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n").trim();

/* ------------------------------------------------------------------ */
/* Helpdesk tools                                                      */
/* ------------------------------------------------------------------ */

const TOOLS: BetaTool[] = [
  { name: "get_my_account", description: "Get the owner's unit(s), unpaid bills with amounts and due dates, and recent payments. Use before answering any question about balances, dues or payments.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "list_my_work_orders", description: "List the owner's recent repair tickets with status.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "create_work_order", description: "File a repair or maintenance ticket for the owner's unit or a common area. Use when the owner reports a problem. Priority HIGH for leaks, no water/power, safety or elevator issues; MEDIUM for things that block normal use; LOW for cosmetic issues.", input_schema: { type: "object", properties: {
    title: { type: "string", description: "Short summary in English, e.g. 'Ceiling leak in bathroom'" },
    description: { type: "string", description: "Details the owner gave, in their words" },
    category: { type: "string", enum: ["Plumbing", "Electrical", "Civil", "Mechanical", "Elevator", "Security", "Housekeeping", "Other"] },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    location: { type: "string", description: "Unit code or common area. Defaults to the owner's unit." },
  }, required: ["title", "category", "priority"], additionalProperties: false } },
  { name: "list_services", description: "List bookable in-unit services with prices and vendors.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "book_service", description: "Book an in-unit service. Only call after the owner has confirmed the service, date/time and quantity. Charged to the monthly statement.", input_schema: { type: "object", properties: {
    service_name: { type: "string" }, slot: { type: "string", description: "ISO 8601 date-time in Asia/Manila, e.g. 2026-11-24T09:00:00+08:00. Mon-Sat 8 AM-5 PM only." }, qty: { type: "integer", minimum: 1, maximum: 6 },
  }, required: ["service_name", "slot"], additionalProperties: false } },
  { name: "escalate_to_manager", description: "Hand the conversation to the human property manager. Use for complaints about neighbours or staff, disputes about charges, legal questions, emergencies, or when the owner asks for a person.", input_schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"], additionalProperties: false } },
];

const SLA: Record<string, number> = { HIGH: 4, MEDIUM: 24, LOW: 72 };

export async function ownerUnits(userId: string) {
  return prisma.unit.findMany({ where: { ownerId: userId } });
}

async function runTool(user: SessionUser, name: string, input: any): Promise<string> {
  const units = await ownerUnits(user.id);
  const unit = units[0];
  switch (name) {
    case "get_my_account": {
      if (!units.length) return "No unit is linked to this account. Ask the owner to contact the admin office.";
      const bills = await prisma.bill.findMany({ where: { unitId: { in: units.map((u) => u.id) }, status: { not: "PAID" } }, orderBy: { period: "asc" } });
      const pays = await prisma.payment.findMany({ where: { bill: { unitId: { in: units.map((u) => u.id) } } }, orderBy: { createdAt: "desc" }, take: 3, include: { bill: true } });
      return JSON.stringify({
        units: units.map((u) => ({ code: u.code, sqm: Number(u.sqm) })), dues_rate_per_sqm: 98,
        unpaid: bills.map((b) => ({ period: monthLong(b.period), amount: peso(Number(b.amount) - Number(b.paid)), due: fmtDate(b.dueDate), overdue: b.dueDate < nowManila() })),
        total_due: peso(bills.reduce((s, b) => s + Number(b.amount) - Number(b.paid), 0)),
        recent_payments: pays.map((p) => ({ for: monthLong(p.bill.period), amount: peso(p.amount), method: p.method, date: fmtDate(p.createdAt), ref: p.reference })),
        pay_options: "Pay from the 'My unit' page (GCash, Maya, card) or by bank transfer.",
      });
    }
    case "list_my_work_orders": {
      const wos = await prisma.workOrder.findMany({ where: { OR: [{ reporterId: user.id }, { unitId: { in: units.map((u) => u.id) } }] }, orderBy: { createdAt: "desc" }, take: 5 });
      return JSON.stringify(wos.map((w) => ({ ticket: `WO-${w.number}`, title: w.title, status: w.status, assignee: w.assignee, opened: fmtDate(w.createdAt) })));
    }
    case "create_work_order": {
      const priority = (["LOW", "MEDIUM", "HIGH"].includes(input.priority) ? input.priority : "MEDIUM") as "LOW" | "MEDIUM" | "HIGH";
      const loc = (input.location || unit?.code || "Common area").toString().slice(0, 60);
      const wo = await prisma.workOrder.create({ data: {
        title: String(input.title).slice(0, 120), description: input.description ? String(input.description).slice(0, 2000) : null,
        category: String(input.category || "Other"), priority, slaHours: SLA[priority], location: loc,
        unitId: units.find((u) => u.code === loc)?.id ?? null, source: "Chat", reporterId: user.id,
        events: { create: { note: `Opened from owner chat. AI set priority ${priority.toLowerCase()} (${SLA[priority]}h deadline).`, author: "AI helpdesk" } },
      } });
      return JSON.stringify({ ticket: `WO-${wo.number}`, priority, deadline_hours: SLA[priority], note: "The manager's team will assign a technician. The owner sees status on the My unit page." });
    }
    case "list_services": {
      const sv = await prisma.service.findMany({ where: { active: true } });
      return JSON.stringify(sv.map((s) => ({ name: s.name, detail: s.detail, price: peso(s.price), per: s.unitLabel, vendor: s.vendor })));
    }
    case "book_service": {
      if (!unit) return "No unit linked; cannot book.";
      const sv = await prisma.service.findFirst({ where: { name: { contains: String(input.service_name), mode: "insensitive" }, active: true } });
      if (!sv) return "Service not found. Call list_services.";
      const slot = new Date(String(input.slot));
      if (isNaN(slot.getTime()) || slot < nowManila()) return "Invalid or past slot. Ask the owner for a future date and time.";
      const qty = Math.max(1, Math.min(6, Number(input.qty) || 1));
      const b = await prisma.booking.create({ data: { serviceId: sv.id, unitId: unit.id, userId: user.id, slot, qty, total: Number(sv.price) * qty, payMethod: "Monthly statement" } });
      return JSON.stringify({ booked: sv.name, when: slot.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }), qty, total: peso(b.total), charged_to: "monthly statement", gate_pass: "sent to lobby guard" });
    }
    case "escalate_to_manager": {
      const wo = await prisma.workOrder.create({ data: { title: "Owner concern: " + String(input.summary).slice(0, 100), description: String(input.summary).slice(0, 2000), category: "Owner concern", priority: "MEDIUM", slaHours: 1, location: unit?.code ?? "N/A", unitId: unit?.id, source: "Chat (escalated)", reporterId: user.id, assignee: "Property manager", status: "ESCALATED" } });
      return JSON.stringify({ escalated: true, ticket: `WO-${wo.number}`, promise: "The property manager will reply within 15 minutes during 7 AM-10 PM." });
    }
  }
  return "Unknown tool";
}

const HELPDESK_SYSTEM = `You are the Skyland Plaza helpdesk assistant, run by Building Mgt AI, the property manager of a two-tower, 172-unit residential condominium in Makati.

Who you talk to: unit owners and residents. Reply in the language they use: English, Tagalog, or Taglish. Be warm and polite (use "po" in Tagalog/Taglish), concise (2-5 short sentences), and practical. Use amounts in Philippine pesos (₱).

Rules:
- Never guess balances, ticket numbers or bookings. Use the tools.
- When an owner reports a problem, file a work order right away with create_work_order, give them the ticket number and deadline, and ask for a photo if it helps.
- Before book_service, confirm the service, date/time and quantity with the owner.
- Emergencies (fire, smoke, gas smell, injury, someone trapped): tell them to call the guard house at local 100 and 911 immediately, then escalate_to_manager.
- Escalate complaints about neighbours or staff, billing disputes, legal questions, or requests for a person.
- Do not share other residents' information.

Building facts:
- Dues: ₱98 per sqm per month, due on the last day of the month. 2% monthly penalty after 30 days (House Rules §7.1). Amenity suspension after 90 days (§7.3).
- Layout: Tower A and Tower B, 25 floors each. Unit codes are floor + unit number + tower, e.g. 1202B = 12th floor, unit 02, Tower B. Penthouses on floors 24-25. Two basement parking levels.
- Amenities (5th level and podium deck): pool 6 AM-9 PM (closed Mondays), gym 5 AM-11 PM, function room ₱2,500 per 4 hours by reservation.
- Renovations: permit required; Mon-Sat 8 AM-5 PM; ₱1,500 fee + ₱10,000 refundable bond; submit plans 5 working days ahead; no changes to plumbing stacks or structural walls.
- Guests: register with the lobby guard; visitor parking by request.
- Admin office: Mon-Sat 8 AM-6 PM, ground floor.`;

export async function helpdeskReply(user: SessionUser, text: string): Promise<{ reply: string; ai: boolean }> {
  const history = await prisma.chatMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 16 });
  if (!aiEnabled()) return { reply: await scriptedReply(user, text), ai: false };

  const messages: BetaMessageParam[] = history.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  messages.push({ role: "user", content: text });
  const units = await ownerUnits(user.id);
  const system = `${HELPDESK_SYSTEM}\n\nThe owner you are talking to: ${user.name}, unit(s) ${units.map((u) => u.code).join(", ") || "none linked"}. Today is ${nowManila().toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "full", timeStyle: "short" })}.`;

  for (let i = 0; i < 6; i++) {
    const res = await ask({ system, messages, tools: TOOLS, effort: "low" });
    if (res.stop_reason === "refusal") return { reply: "Pasensya na po, I can't help with that here. I can connect you to the property manager.", ai: true };
    const uses = res.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !uses.length) return { reply: textOf(res) || "Noted po.", ai: true };
    messages.push({ role: "assistant", content: res.content as any });
    const results: BetaToolResultBlockParam[] = [];
    for (const u of uses) {
      try { results.push({ type: "tool_result", tool_use_id: u.id, content: await runTool(user, u.name, u.input) }); }
      catch (e) { results.push({ type: "tool_result", tool_use_id: u.id, content: "Tool failed: " + (e as Error).message, is_error: true }); }
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: "Sorry po, that took longer than expected. I've noted your message and the admin team will follow up.", ai: true };
}

/* Scripted fallback that still reads and writes real data */
async function scriptedReply(user: SessionUser, raw: string): Promise<string> {
  const t = raw.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  if (has("tulo", "leak", "tumutulo", "dripping", "basa", "baha")) {
    const r = JSON.parse(await runTool(user, "create_work_order", { title: "Leak reported via chat", description: raw, category: "Plumbing", priority: "HIGH" }));
    return `Sorry po to hear that! I've filed ticket ${r.ticket} (Plumbing, high priority). A technician will be assigned and should be on site within ${r.deadline_hours} hours. Please put a pail under the leak and avoid any switches nearby.`;
  }
  if (has("elevator", "elevador", "lift")) {
    const r = JSON.parse(await runTool(user, "create_work_order", { title: "Elevator issue reported via chat", description: raw, category: "Elevator", priority: "HIGH", location: "Elevators" }));
    return `Salamat po for reporting! I've logged it as ${r.ticket} (high priority) and alerted the engineer. Please use the other elevators for now.`;
  }
  if (has("balance", "magkano", "bayad", "soa", "dues", "statement", "utang")) {
    const a = JSON.parse(await runTool(user, "get_my_account", {}));
    if (!a.units) return "Wala pa pong unit na naka-link sa account ninyo. Please contact the admin office.";
    if (!a.unpaid.length) return `Wala po kayong balance, salamat! Your last payment was ${a.recent_payments[0]?.amount ?? "-"} on ${a.recent_payments[0]?.date ?? "-"}.`;
    return `Your balance is ${a.total_due} po: ${a.unpaid.map((u: any) => `${u.period} ${u.amount} (due ${u.due})`).join("; ")}. You can pay on the My unit page via GCash, Maya or card.`;
  }
  if (has("ticket", "repair status", "status ng")) {
    const w = JSON.parse(await runTool(user, "list_my_work_orders", {}));
    return w.length ? w.map((x: any) => `${x.ticket} ${x.title}: ${x.status.replace("_", " ").toLowerCase()}`).join("\n") : "Wala po kayong open tickets.";
  }
  if (has("aircon", "pest", "cleaning", "book", "service")) return "You can book aircon cleaning (₱1,200), deep cleaning, pest control and more on the Services page po. Rates are board-approved and charged to your monthly statement.";
  if (has("renovat", "permit", "contractor")) return "Renovations are allowed with a permit po: Mon-Sat 8 AM-5 PM, ₱1,500 fee + ₱10,000 refundable bond, plans submitted 5 working days ahead. No changes to plumbing stacks or structural walls.";
  if (has("pool", "gym", "function room", "amenity")) return "Pool 6 AM-9 PM (closed Mondays), gym 5 AM-11 PM, function room ₱2,500 per 4 hours by reservation po.";
  if (has("complain", "reklamo", "ingay", "noise", "manager", "tao", "human", "person")) {
    const r = JSON.parse(await runTool(user, "escalate_to_manager", { summary: raw }));
    return `I've passed this to the property manager (${r.ticket}). They'll reply within 15 minutes po.`;
  }
  return "Noted po! I can check your balance, file a repair ticket, or connect you to the property manager. Ano pong kailangan ninyo?";
}

/* ------------------------------------------------------------------ */
/* Board report                                                        */
/* ------------------------------------------------------------------ */

export async function generateBoardReport(period: string): Promise<{ content: string; model: string }> {
  const [b, trend, overdue, sla] = await Promise.all([budgetFor(period), collectionTrend(12), overdueAccounts(), slaStats(30)]);
  const thisM = trend.find((t) => t.period === period); const prevM = trend[trend.findIndex((t) => t.period === period) - 1];
  const facts = {
    period: monthLong(period),
    collections: { rate_pct: thisM?.rate.toFixed(1), prev_rate_pct: prevM?.rate.toFixed(1), billed: peso(thisM?.billed ?? 0) },
    spending: { budget: peso(b.budget), actual: peso(b.actual), variance_pct: b.variance.toFixed(1), lines: b.lines.map((l) => ({ category: l.category, budget: peso(l.budget), actual: peso(l.actual), note: l.note })) },
    receivables: { total_overdue: peso(overdue.reduce((s, o) => s + o.amount, 0)), units: overdue.length, over_60_days: overdue.filter((o) => o.days > 60).map((o) => ({ unit: o.code, amount: peso(o.amount), days: o.days })) },
    operations_30d: { closed: sla.closed, on_time_pct: sla.pct.toFixed(0), avg_rating: sla.rating.toFixed(1) },
  };
  if (!aiEnabled()) {
    const over = b.lines.filter((l) => Number(l.actual) > Number(l.budget));
    const content = `## Summary\n${facts.period} closed with a ${facts.collections.rate_pct}% collection rate (previous month ${facts.collections.prev_rate_pct}%) and spending of ${facts.spending.actual} against a budget of ${facts.spending.budget} (${facts.spending.variance_pct}%).\n\n## Collections\nOverdue balances total ${facts.receivables.total_overdue} across ${facts.receivables.units} units. ${facts.receivables.over_60_days.length} units are more than 60 days late.\n\n## Spending\n${over.length ? over.map((l) => `- ${l.category}: ${peso(l.actual)} vs ${peso(l.budget)} budget. ${l.note ?? ""}`).join("\n") : "All lines within budget."}\n\n## Operations\n${sla.closed} work orders closed in the last 30 days, ${facts.operations_30d.on_time_pct}% within deadline. Average owner rating ${facts.operations_30d.avg_rating}/5.\n\n## For the board\n- Review over-budget lines above.\n- Decide on follow-up for units over 60 days late.`;
    return { content, model: "template (set ANTHROPIC_API_KEY for AI reports)" };
  }
  const res = await ask({
    effort: "medium",
    system: "You write the monthly report from the property manager to the board of a Philippine condominium corporation. Audience: volunteer board members who want plain facts. Use Markdown with these sections: Summary, Collections, Spending, Operations, Decisions for the board. Use only the numbers provided; never invent figures. Explain every variance over 2% in one sentence. Keep it under 400 words. Peso amounts with ₱.",
    messages: [{ role: "user", content: `Data for the report (JSON):\n${JSON.stringify(facts, null, 2)}` }],
  });
  return { content: textOf(res), model: MODEL };
}

/* ------------------------------------------------------------------ */
/* Collection reminders                                                */
/* ------------------------------------------------------------------ */

export function templateReminder(tone: string, a: { code: string; owner: string; amount: number; days: number }) {
  const link = `pay link on the Skyland owner portal`;
  switch (tone) {
    case "nudge": return `Hi ${a.owner}! Friendly reminder lang po from Skyland admin: Unit ${a.code} has ${peso(a.amount)} due (${a.days} days). You can pay in seconds using the ${link} (GCash, Maya or card). Salamat po!`;
    case "friendly": return `Good day ${a.owner}. Our records show ${peso(a.amount)} outstanding for Unit ${a.code}, ${a.days} days overdue. A 2% monthly penalty applies after 30 days (House Rules §7.1). If you've already paid, just reply with the receipt. Otherwise please use the ${link}.`;
    case "firm": return `Dear ${a.owner}, Unit ${a.code} has an unpaid balance of ${peso(a.amount)} (${a.days} days). To avoid suspension of amenity privileges under House Rules §7.3, please settle or reply to arrange a payment plan within 7 days. We can split this into 2-3 instalments.`;
    default: return `FINAL NOTICE. Dear ${a.owner}, despite previous reminders Unit ${a.code} owes ${peso(a.amount)} (${a.days} days). Under the Master Deed and House Rules §7.3, amenity access will be suspended and the account may be endorsed for collection. Please contact the admin office today to settle or agree a plan.`;
  }
}

export async function draftReminder(tone: string, a: { code: string; owner: string; amount: number; days: number }) {
  if (!aiEnabled()) return templateReminder(tone, a);
  const res = await ask({
    effort: "low", max_tokens: 2000,
    system: "You write payment reminders from a Philippine condominium's property manager to unit owners, sent by Viber or SMS. Polite, clear, Taglish where natural, under 90 words, no emojis in firm or final notices. Mention the amount, unit, days overdue and how to pay (pay link on the Skyland owner portal: GCash, Maya, card). Firm and final notices may cite House Rules §7.1 (2% monthly penalty after 30 days) and §7.3 (amenity suspension after 90 days). Output only the message.",
    messages: [{ role: "user", content: `Tone: ${tone}. Owner: ${a.owner}. Unit: ${a.code}. Amount: ${peso(a.amount)}. Days overdue: ${a.days}.` }],
  });
  return textOf(res) || templateReminder(tone, a);
}

export { currentPeriod };

/* ------------------------------------------------------------------ */
/* Resident announcements (routine updates)                            */
/* ------------------------------------------------------------------ */
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const AnnouncementDraft = z.object({
  title: z.string().describe("Short subject line, under 70 characters"),
  bodyEn: z.string().describe("Full message in clear English, 60-180 words, short paragraphs"),
  bodyTl: z.string().describe("The same message in natural Taglish as spoken in Metro Manila, polite with 'po'"),
  smsEn: z.string().describe("SMS version in English, under 300 characters, no links"),
  smsTl: z.string().describe("SMS version in Taglish, under 300 characters, no links"),
});
export type AnnouncementDraftT = z.infer<typeof AnnouncementDraft>;

export async function draftAnnouncement(input: { category: string; notes: string; audience: string }): Promise<AnnouncementDraftT & { ai: boolean }> {
  if (!aiEnabled()) {
    const body = `${input.notes.trim()}\n\nFor questions, message the Skyland helpdesk in the owner portal or visit the admin office (Mon-Sat, 8 AM-6 PM).`;
    return { ai: false, title: `${input.category}`, bodyEn: body, bodyTl: body, smsEn: input.notes.slice(0, 280), smsTl: input.notes.slice(0, 280) };
  }
  const res = await client().messages.parse({
    model: MODEL, max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(AnnouncementDraft) },
    system: "You write announcements from the property manager of Skyland Plaza, a two-tower, 172-unit condominium in Makati, to unit owners and residents. Be warm, clear and specific: what is happening, when, who is affected, what residents should do, and who to contact. Use the facts given; never invent dates, amounts or names. If a needed fact is missing, write [ADD: ...] so the manager fills it in. Amounts in ₱. Contacts: owner portal helpdesk, admin office Mon-Sat 8 AM-6 PM, guard house local 100.",
    messages: [{ role: "user", content: `Type of update: ${input.category}\nAudience: ${input.audience}\nManager's notes:\n${input.notes}` }],
  } as any) as any;
  const out = res.parsed_output as AnnouncementDraftT | null;
  if (!out) throw new Error("The AI draft could not be read. Please try again.");
  return { ...out, ai: true };
}

// ---------- Resident feedback classification ----------
const TOPICS = ["Repairs", "Elevators", "Cleanliness", "Security", "Water", "Communication", "Amenities", "Noise", "Staff", "Dues", "Other"] as const;
const Feedback = z.object({ topic: z.enum(TOPICS), sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]) });
const KEYWORDS: [typeof TOPICS[number], RegExp][] = [
  ["Elevators", /elevator|lift|elev/i], ["Water", /water|tubig|leak|tulo|pressure|plumb/i], ["Cleanliness", /clean|dirty|madumi|garbage|basura|smell|amoy|trash/i],
  ["Security", /guard|security|cctv|safe|gate|bantay/i], ["Noise", /noise|ingay|maingay|loud|karaoke|renovat/i], ["Amenities", /pool|gym|function|court|amenit|grill/i],
  ["Communication", /update|announce|inform|notice|message|abiso|reply/i], ["Staff", /staff|admin|rude|bait|friendly|courteous|manager/i], ["Dues", /dues|bill|payment|bayad|fee/i],
  ["Repairs", /repair|fix|technician|aircon|ayos|sira|broken/i],
];
export function classifyLocal(comment: string | null | undefined, score: number) {
  const topic = (comment && KEYWORDS.find(([, re]) => re.test(comment))?.[0]) || (comment ? "Other" : null);
  return { topic, sentiment: score >= 4 ? "POSITIVE" : score === 3 ? "NEUTRAL" : "NEGATIVE" };
}
export async function classifyFeedback(comment: string | null | undefined, score: number): Promise<{ topic: string | null; sentiment: string }> {
  const local = classifyLocal(comment, score);
  if (!comment || !aiEnabled()) return local;
  try {
    const res = await client().messages.parse({
      model: MODEL, max_tokens: 1000, output_config: { effort: "low", format: zodOutputFormat(Feedback) },
      system: "Classify a condominium resident's feedback (English, Filipino or Taglish) into one topic and a sentiment. Consider both the comment and the 1-5 score.",
      messages: [{ role: "user", content: `Score: ${score}/5\nComment: ${comment}` }],
    } as any) as any;
    return (res.parsed_output as z.infer<typeof Feedback>) ?? local;
  } catch { return local; }
}
export const anthropicClient = () => client();

// ---------- Manager morning briefing (spoken) ----------
/** Turns the day's facts into a short script read aloud by the phone. Falls back to the plain template. */
export async function writeBriefing(facts: string, fallback: string): Promise<{ text: string; ai: boolean }> {
  if (!aiEnabled()) return { text: fallback, ai: false };
  try {
    const res = await client().messages.create({
      model: MODEL, max_tokens: 2000, output_config: { effort: "low" },
      system: "You are the AI operations assistant of a condominium in Metro Manila. Write the property manager's spoken morning briefing: under 150 words, warm and brisk, like a voice note from a trusted colleague. Lead with what needs action first and say exactly what to do. Natural English with a light touch of Taglish where it fits (polite, 'po' once at most). No markdown, no bullet points, no emojis. Say money as 'pesos' (e.g. '45,200 pesos'). Use only the facts given; never invent names, numbers or events.",
      messages: [{ role: "user", content: facts }],
    } as any) as any;
    const text = (res.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return text ? { text, ai: true } : { text: fallback, ai: false };
  } catch { return { text: fallback, ai: false }; }
}

// ---------- Photo-to-ticket ----------
export const REPAIR_CATEGORIES = ["Plumbing", "Electrical", "Civil", "Mechanical", "Elevator", "Security", "Housekeeping", "Other"] as const;
const PhotoRead = z.object({
  title: z.string().describe("Short ticket title in English, e.g. 'Water leaking from bathroom ceiling'"),
  category: z.enum(REPAIR_CATEGORIES),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).describe("HIGH for active leaks, sparks, smoke, no water/power, safety or elevator problems; MEDIUM if it blocks normal use; LOW if cosmetic"),
  seen: z.string().describe("One sentence on what is visible in the photo, for the technician"),
  advice: z.string().describe("One or two short sentences telling the resident what to do safely while waiting, in polite English with light Taglish (po)"),
  confident: z.boolean().describe("false if the photo is unclear or does not show a building problem"),
});
export type PhotoReadT = z.infer<typeof PhotoRead>;

const CAT_WORDS: [typeof REPAIR_CATEGORIES[number], RegExp][] = [
  ["Plumbing", /leak|tulo|drip|water|tubig|pipe|faucet|sink|toilet|drain|clog|bara|shower|heater/i],
  ["Electrical", /spark|outlet|socket|breaker|light|ilaw|power|kuryente|wire|switch|smoke detector|intercom/i],
  ["Mechanical", /aircon|ac |a\/c|fan|exhaust|ventil|pump/i],
  ["Elevator", /elevator|lift/i],
  ["Civil", /crack|tile|ceiling|wall|door|window|paint|stain|damp|bitak/i],
  ["Housekeeping", /cockroach|ipis|ants|langgam|pest|rat|daga|garbage|smell|amoy|dirty/i],
  ["Security", /lock|door access|cctv|guard|stranger/i],
];
const URGENT = /leak|tulo|flood|spark|smoke|usok|fire|sunog|gas|no water|walang tubig|no power|brownout|stuck|elevator/i;

export function readPhotoLocal(caption: string): PhotoReadT {
  const c = caption.trim();
  const category = CAT_WORDS.find(([, re]) => re.test(c))?.[0] ?? "Other";
  const priority = URGENT.test(c) ? "HIGH" : category === "Other" || category === "Housekeeping" ? "LOW" : "MEDIUM";
  const title = c ? c.charAt(0).toUpperCase() + c.slice(0, 90).slice(1) : "Repair request with photo";
  const advice = priority === "HIGH"
    ? "For your safety po, keep away from the area and turn off the water valve or breaker if it is safe to do so. The team is on the way."
    : "Thank you po! A technician will check the photo and contact you to schedule a visit.";
  return { title, category, priority, seen: c ? `Resident's note: ${c}` : "Photo attached by the resident.", advice, confident: Boolean(c) };
}

export async function readRepairPhoto(dataUrl: string, caption: string): Promise<PhotoReadT & { ai: boolean }> {
  if (!aiEnabled()) return { ...readPhotoLocal(caption), ai: false };
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return { ...readPhotoLocal(caption), ai: false };
  try {
    const res = await client().messages.parse({
      model: MODEL, max_tokens: 2000, output_config: { effort: "low", format: zodOutputFormat(PhotoRead) },
      system: "You triage repair photos sent by residents of a condominium in Metro Manila. Look at the photo (and the resident's optional note, which may be in English, Filipino or Taglish) and file a maintenance ticket. Be specific about what you can actually see; do not guess hidden causes. If the photo is not a building problem, say so in 'seen' and set confident to false.",
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
        { type: "text", text: caption ? `Resident's note: ${caption}` : "No note from the resident." },
      ] }],
    } as any) as any;
    const out = res.parsed_output as PhotoReadT | null;
    return out ? { ...out, ai: true } : { ...readPhotoLocal(caption), ai: false };
  } catch { return { ...readPhotoLocal(caption), ai: false }; }
}

// ---------- Savings advisor summary ----------
/** Rewrites the computed savings ideas as a short note to the board. The numbers come from our data, never the model. */
export async function writeAdvice(facts: string, fallback: string): Promise<{ text: string; ai: boolean }> {
  if (!aiEnabled()) return { text: fallback, ai: false };
  try {
    const res = await client().messages.create({
      model: MODEL, max_tokens: 1500, output_config: { effort: "low" },
      system: "You are the AI savings advisor of a condominium corporation in Makati. Write a note to the board in under 90 words: the total yearly saving, then the two or three ideas to start with and why, most urgent first. Plain, confident English; polite. No markdown, bullets or emojis. Use only the facts and peso amounts given; never invent numbers, vendors or events.",
      messages: [{ role: "user", content: facts }],
    } as any) as any;
    const text = (res.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return text ? { text, ai: true } : { text: fallback, ai: false };
  } catch { return { text: fallback, ai: false }; }
}

// ---------- Generic writer for board documents (agenda, minutes, advisories) ----------
/** One-shot writing task. Uses only the facts given; returns the fallback when there is no key or the call fails. */
export async function writeDoc(system: string, facts: string, fallback: string): Promise<{ text: string; ai: boolean }> {
  if (!aiEnabled()) return { text: fallback, ai: false };
  try {
    const res = await ask({ system: system + "\nUse only the facts given; never invent names, numbers, votes or decisions. Use Philippine pesos (₱).", messages: [{ role: "user", content: facts }], effort: "low", max_tokens: 4000 });
    const text = textOf(res);
    return text ? { text, ai: true } : { text: fallback, ai: false };
  } catch { return { text: fallback, ai: false }; }
}
