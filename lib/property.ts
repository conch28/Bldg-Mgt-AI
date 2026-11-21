/**
 * Resale & leasing service for owners.
 *  1. Price check: comparable listings in Skyland, nearby buildings within 1 km and past Skyland deals.
 *  2. AI writes the listing (English + Taglish); the owner approves with one tap.
 *  3. Publishing: Facebook Page through the Graph API when FB_PAGE_ID + FB_PAGE_TOKEN are set.
 *     Marketplace and groups have no public posting API, so they go to the leasing team's queue
 *     with a ready-to-post kit. Without keys everything is recorded as a demo post.
 *  4. AI answers inquiries and books viewings (a guest pass is created for the viewer).
 * A licensed broker partner handles negotiation, contracts and closing.
 */
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "./db";
import { aiEnabled, anthropicClient, MODEL } from "./ai";
import { peso, fmtDateTime } from "./format";

export const BROKER = { name: "Carla Mendoza", firm: "Partner brokerage", license: "PRC-licensed real estate broker" };
export const FEES = { LEASE: "1 month's rent, paid by the owner when the lease is signed", SALE: "3% to 5% of the sale price, paid by the seller at closing" };
export const CHANNEL_LABEL: Record<string, string> = { FB_PAGE: "Facebook Page", FB_MARKETPLACE: "Facebook Marketplace", FB_GROUPS: "Facebook groups (4 condo groups)" };
export const FURNISH: Record<string, string> = { BARE: "Bare", SEMI: "Semi-furnished", FULL: "Fully furnished" };
const SOURCE_W: Record<string, number> = { SKYLAND_DEAL: 3, SKYLAND_LISTING: 2, NEARBY: 1 };

export type PriceCheck = {
  low: number; mid: number; high: number; perSqm: number;
  counts: { deals: number; same: number; nearby: number };
  comps: { id: string; label: string; building: string; distanceKm: number; sqm: number; beds: number; price: number; perSqm: number; date: Date; source: string }[];
  daysEstimate: number; note: string;
};

function weightedMedian(vals: { v: number; w: number }[]) {
  const s = [...vals].sort((a, b) => a.v - b.v); const total = s.reduce((t, x) => t + x.w, 0);
  let acc = 0; for (const x of s) { acc += x.w; if (acc >= total / 2) return x.v; }
  return s[s.length - 1]?.v ?? 0;
}

export async function priceCheck(kind: "LEASE" | "SALE", unit: { sqm: number; floor: number }, beds: number, furnished = "SEMI"): Promise<PriceCheck> {
  const since = new Date(Date.now() - 540 * 86400000);
  const all = await prisma.marketComp.findMany({ where: { kind, date: { gte: since }, distanceKm: { lte: 1 } }, orderBy: { date: "desc" } });
  const near = all.filter((c) => Math.abs(c.beds - beds) <= 1);
  const pool = near.length >= 5 ? near : all;
  const rows = pool.map((c) => ({ c, per: Number(c.price) / Number(c.sqm), w: SOURCE_W[c.source] * (c.beds === beds ? 1.5 : 1) * (Date.now() - c.date.getTime() < 180 * 86400000 ? 1.3 : 1) }));
  let per = weightedMedian(rows.map((r) => ({ v: r.per, w: r.w })));
  // small adjustments the brokers use: higher floors and furniture command a premium (leases only for furniture)
  const floorAdj = 1 + Math.max(-0.04, Math.min(0.06, (unit.floor - 15) * 0.002));
  const furnAdj = kind === "LEASE" ? (furnished === "FULL" ? 1.06 : furnished === "BARE" ? 0.93 : 1) : furnished === "FULL" ? 1.02 : 1;
  per = per * floorAdj * furnAdj;
  const round = kind === "LEASE" ? 500 : 50000;
  const mid = Math.round((per * unit.sqm) / round) * round;
  const ranked = rows.sort((a, b) => b.w - a.w || b.c.date.getTime() - a.c.date.getTime());
  // show a mix: the best few from each source so the owner sees all three kinds of evidence
  const mix = [...ranked.filter((r) => r.c.source === "SKYLAND_DEAL").slice(0, 3), ...ranked.filter((r) => r.c.source === "SKYLAND_LISTING").slice(0, 2), ...ranked.filter((r) => r.c.source === "NEARBY").slice(0, 3)];
  const comps = mix.map(({ c, per }) => ({
    id: c.id, source: c.source, label: c.source === "SKYLAND_DEAL" ? (kind === "LEASE" ? "Leased in Skyland" : "Sold in Skyland") : c.source === "SKYLAND_LISTING" ? "Listed in Skyland" : `Listed ${c.distanceKm.toFixed(1)} km away`,
    building: c.building, distanceKm: c.distanceKm, sqm: Number(c.sqm), beds: c.beds, price: Number(c.price), perSqm: Math.round(per), date: c.date,
  }));
  const counts = { deals: pool.filter((c) => c.source === "SKYLAND_DEAL").length, same: pool.filter((c) => c.source === "SKYLAND_LISTING").length, nearby: pool.filter((c) => c.source === "NEARBY").length };
  return {
    low: Math.round((mid * 0.95) / round) * round, mid, high: Math.round((mid * 1.05) / round) * round, perSqm: Math.round(per), counts, comps,
    daysEstimate: kind === "LEASE" ? 21 : 75,
    note: `Based on ${pool.length} comparable ${kind === "LEASE" ? "rentals" : "sales"} in the last 18 months: ${counts.deals} closed Skyland deals, ${counts.same} current Skyland listings and ${counts.nearby} listings within 1 km. Adjusted for floor ${unit.floor}${kind === "LEASE" ? ` and ${FURNISH[furnished].toLowerCase()}` : ""}.`,
  };
}

const ListingCopy = z.object({
  title: z.string().describe("Listing headline under 70 characters, e.g. '1BR for lease at Skyland Tower, high floor, city view'"),
  body: z.string().describe("Facebook post in English, 70-140 words, short lines, facts only, ends with how to inquire"),
  bodyTl: z.string().describe("The same post in natural Taglish as used in Metro Manila property groups"),
  highlights: z.array(z.string()).describe("3 to 5 short selling points, each under 40 characters"),
});
type ListingCopyT = z.infer<typeof ListingCopy>;

export type ListingInput = { kind: "LEASE" | "SALE"; unitCode: string; floor: number; sqm: number; beds: number; furnished: string; price: number; notes: string };

export function templateListing(i: ListingInput): ListingCopyT {
  const what = i.beds === 0 ? "Studio" : `${i.beds}BR`;
  const price = i.kind === "LEASE" ? `${peso(i.price)}/month` : peso(i.price);
  const extra = i.notes.trim() ? `\n${i.notes.trim()}` : "";
  return {
    title: `${what} for ${i.kind === "LEASE" ? "lease" : "sale"} at Skyland Tower, ${i.floor}th floor`,
    body: `${what} for ${i.kind === "LEASE" ? "LEASE" : "SALE"} · Skyland Tower\n${price}\n\n• ${i.sqm} sqm, ${i.floor}th floor\n• ${FURNISH[i.furnished]}\n• Pool, gym, 24/7 security, near malls and offices${extra}\n\n${i.kind === "LEASE" ? "1 month advance, 2 months deposit. Minimum 1 year." : "Clean title. Bank financing welcome."}\nMessage us to book a viewing. Our assistant replies in minutes.`,
    bodyTl: `${what} for ${i.kind === "LEASE" ? "rent" : "sale"} sa Skyland Tower!\n${price}\n\n• ${i.sqm} sqm, ${i.floor}th floor\n• ${FURNISH[i.furnished]}\n• May pool, gym at 24/7 security${extra}\n\nPM lang po para sa viewing, mabilis kaming sumagot.`,
    highlights: [`${i.sqm} sqm, ${i.floor}th floor`, FURNISH[i.furnished], "Pool, gym, 24/7 security", i.kind === "LEASE" ? "Ready for move-in" : "Clean title"],
  };
}

export async function writeListing(i: ListingInput): Promise<ListingCopyT & { ai: boolean }> {
  if (!aiEnabled()) return { ...templateListing(i), ai: false };
  try {
    const res = await anthropicClient().messages.parse({
      model: MODEL, max_tokens: 3000, output_config: { effort: "low", format: zodOutputFormat(ListingCopy) },
      system: "You write property listings for Facebook (Page, Marketplace and Metro Manila condo groups) for units in Skyland Tower, a well-run condominium with pool, gym and 24/7 security. Be honest and specific. Use only the facts given; never invent amenities, views, parking or prices. Prices in ₱. No ALL CAPS shouting and no emojis beyond one or two bullets.",
      messages: [{ role: "user", content: `${i.kind === "LEASE" ? "For lease" : "For sale"}\nUnit: ${i.unitCode}, floor ${i.floor}, ${i.sqm} sqm, ${i.beds === 0 ? "studio" : i.beds + " bedroom(s)"}, ${FURNISH[i.furnished]}\nPrice: ${peso(i.price)}${i.kind === "LEASE" ? " per month" : ""}\nOwner's notes: ${i.notes || "(none)"}` }],
    } as any) as any;
    const out = res.parsed_output as ListingCopyT | null;
    return out ? { ...out, ai: true } : { ...templateListing(i), ai: false };
  } catch { return { ...templateListing(i), ai: false }; }
}

export type Post = { channel: string; status: "POSTED" | "QUEUED" | "DEMO" | "FAILED"; info: string; at: string };

export async function publishListing(l: { id: string; title: string; body: string; channels: string[] }): Promise<Post[]> {
  const at = new Date().toISOString(); const out: Post[] = [];
  const page = process.env.FB_PAGE_ID, token = process.env.FB_PAGE_TOKEN;
  for (const ch of l.channels) {
    if (ch === "FB_PAGE") {
      if (!page || !token) { out.push({ channel: ch, status: "DEMO", info: "Demo: connect the Facebook Page to post live", at }); continue; }
      try {
        const r = await fetch(`https://graph.facebook.com/v21.0/${page}/feed`, { method: "POST", body: new URLSearchParams({ message: `${l.title}\n\n${l.body}`, access_token: token }) });
        const j = await r.json().catch(() => ({}));
        out.push(r.ok ? { channel: ch, status: "POSTED", info: `Posted · ${j.id ?? ""}`, at } : { channel: ch, status: "FAILED", info: `Facebook error ${r.status}`, at });
      } catch (e) { out.push({ channel: ch, status: "FAILED", info: (e as Error).message, at }); }
    } else {
      out.push({ channel: ch, status: page && token ? "QUEUED" : "DEMO", info: page && token ? "Sent to the leasing team with the post kit" : "Demo: our team posts this from the AI kit", at });
    }
  }
  return out;
}

const Reply = z.object({ reply: z.string().describe("Reply to the inquirer, under 90 words, in the same language they used"), wantsViewing: z.boolean() });

export function templateReply(l: { kind: string; price: number; title: string }, name: string, msg: string, slot: string) {
  const tl = /\b(po|pa|ba|pwede|magkano|ilan)\b/i.test(msg);
  const price = l.kind === "LEASE" ? `${peso(l.price)} a month (1 month advance, 2 months deposit)` : `${peso(l.price)}, negotiable for serious buyers`;
  return tl
    ? `Hi ${name}! Salamat po sa inquiry. Available pa po ang unit: ${price}. Pwede po kayong mag-viewing sa ${slot}. Reply lang po ng "OK" para ma-book, at magpapadala kami ng guest pass para sa lobby.`
    : `Hi ${name}, thanks for your interest! The unit is still available at ${price}. I can book you a viewing on ${slot}. Reply "OK" and I'll send a guest pass for the lobby.`;
}

export async function answerInquiry(l: { kind: string; price: number; title: string; body: string }, name: string, msg: string, slot: Date) {
  const s = fmtDateTime(slot);
  if (!aiEnabled()) return { reply: templateReply(l, name, msg, s), ai: false };
  try {
    const res = await anthropicClient().messages.parse({
      model: MODEL, max_tokens: 1500, output_config: { effort: "low", format: zodOutputFormat(Reply) },
      system: `You answer Facebook inquiries for a condo listing at Skyland Tower on behalf of the owner's leasing team. Be friendly and brief. Answer only from the listing; if asked something not in it, say the broker will confirm. Offer the viewing slot ${s}. Never agree to a discount; say the broker handles offers.`,
      messages: [{ role: "user", content: `Listing:\n${l.title}\n${l.body}\nPrice: ${peso(l.price)}${l.kind === "LEASE" ? "/month" : ""}\n\nMessage from ${name}:\n${msg}` }],
    } as any) as any;
    const out = res.parsed_output as z.infer<typeof Reply> | null;
    return out ? { reply: out.reply, ai: true } : { reply: templateReply(l, name, msg, s), ai: false };
  } catch { return { reply: templateReply(l, name, msg, s), ai: false }; }
}

/** Next viewing slot: tomorrow or later, 10 AM / 2 PM / 4 PM Manila, Mon-Sat, skipping booked ones. */
export async function nextViewingSlot(listingId: string) {
  const taken = new Set((await prisma.inquiry.findMany({ where: { listingId, viewingAt: { not: null } }, select: { viewingAt: true } })).map((i) => i.viewingAt!.getTime()));
  for (let d = 1; d < 14; d++) {
    const day = new Date(Date.now() + d * 86400000);
    const ymd = day.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    if (new Date(`${ymd}T12:00:00+08:00`).getUTCDay() === 0) continue;
    for (const h of ["10", "14", "16"]) { const t = new Date(`${ymd}T${h}:00:00+08:00`); if (!taken.has(t.getTime())) return t; }
  }
  return new Date(Date.now() + 2 * 86400000);
}
