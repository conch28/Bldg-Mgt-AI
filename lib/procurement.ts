/**
 * Procurement and inventory controls. The rules follow common practice for Philippine condo associations:
 * approval limits by amount, three quotes above the petty limit, nobody approves or receives their own
 * request, and every replacement is logged against the fixture it replaced with the old part returned.
 * The checks below run on our own data, so they work with or without an Anthropic key.
 */
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { nowManila, peso } from "./format";

const num = (v: string | undefined, d: number) => (v && !isNaN(Number(v)) ? Number(v) : d);
/** Approval limits in pesos. The board can change them with env vars once it passes its own policy. */
export const LIMITS = {
  manager: num(process.env.PROC_MANAGER_LIMIT, 10000), // up to this: manager approves, 1 quote is enough
  board1: num(process.env.PROC_BOARD1_LIMIT, 50000), // up to this: 3 quotes, manager + 1 board member
  quotesAbove: num(process.env.PROC_QUOTES_ABOVE, 10000), // 3 quotes needed above this
  overBenchmark: 0.15, // flag prices 15% above benchmark
};

export type Approval = { id: string; name: string; role: Role; at: string };
export type Rule = { quotes: number; manager: number; board: number; label: string };

export function ruleFor(amount: number): Rule {
  if (amount <= LIMITS.manager) return { quotes: 1, manager: 1, board: 0, label: `Up to ${peso(LIMITS.manager)}: manager approves` };
  if (amount <= LIMITS.board1) return { quotes: 3, manager: 1, board: 1, label: `${peso(LIMITS.manager + 1)} to ${peso(LIMITS.board1)}: 3 quotes, manager and 1 board member` };
  return { quotes: 3, manager: 0, board: 2, label: `Over ${peso(LIMITS.board1)}: 3 quotes and 2 board members` };
}

type PR = { requestedBy: string; approvals: unknown; receivedBy: string | null; status: string; chosenQuote: string | null; quotes: { id: string; total: unknown }[] };
export const approvalsOf = (pr: { approvals: unknown }) => (Array.isArray(pr.approvals) ? (pr.approvals as Approval[]) : []);
export const amountOf = (pr: PR) => {
  const q = pr.quotes.find((x) => x.id === pr.chosenQuote) ?? [...pr.quotes].sort((a, b) => Number(a.total) - Number(b.total))[0];
  return q ? Number(q.total) : 0;
};
export function approvalProgress(pr: PR) {
  const rule = ruleFor(amountOf(pr));
  const a = approvalsOf(pr);
  const mgr = a.filter((x) => x.role === "MANAGER" || x.role === "ADMIN").length;
  const brd = a.filter((x) => x.role === "BOARD").length;
  return { rule, mgr, brd, done: mgr >= rule.manager && brd >= rule.board };
}

/** Can this person approve this request right now? Returns the reason when not. */
export function canApprove(pr: PR, user: { id: string; role: Role }): { ok: boolean; why?: string } {
  if (pr.status !== "PENDING") return { ok: false, why: "Not waiting for approval." };
  if (pr.requestedBy === user.id) return { ok: false, why: "You raised this request, so someone else has to approve it." };
  if (approvalsOf(pr).some((a) => a.id === user.id)) return { ok: false, why: "You already approved this." };
  const { rule, mgr, brd } = approvalProgress(pr);
  const isMgr = user.role === "MANAGER" || user.role === "ADMIN";
  if (isMgr && mgr < rule.manager) return { ok: true };
  if (user.role === "BOARD" && brd < rule.board) return { ok: true };
  return { ok: false, why: user.role === "BOARD" ? "No board approval needed at this amount." : "Waiting for the board." };
}

/** Receiving must be done by someone who did not request or approve the purchase. */
export function canReceive(pr: PR, userId: string): { ok: boolean; why?: string } {
  if (pr.status !== "ORDERED") return { ok: false, why: "Not ordered yet." };
  if (pr.requestedBy === userId) return { ok: false, why: "You requested this, so another staff member (or the guard) must receive it." };
  if (approvalsOf(pr).some((a) => a.id === userId)) return { ok: false, why: "You approved this, so another staff member must receive it." };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Red flags                                                           */
/* ------------------------------------------------------------------ */

export type Flag = { key: string; level: "high" | "medium"; kind: string; title: string; why: string; atStake: number; href: string };
const DAY = 86400000;

export async function controlFlags(): Promise<Flag[]> {
  const now = nowManila().getTime();
  const [prs, reps, moves] = await Promise.all([
    prisma.purchaseRequest.findMany({ where: { createdAt: { gte: new Date(now - 180 * DAY) } }, include: { quotes: true, item: true }, orderBy: { createdAt: "asc" } }),
    prisma.replacement.findMany({ where: { doneAt: { gte: new Date(now - 400 * DAY) } }, include: { asset: true }, orderBy: { doneAt: "asc" } }),
    prisma.stockMove.findMany({ where: { createdAt: { gte: new Date(now - 60 * DAY) }, kind: { in: ["ISSUE", "ADJUST"] } }, include: { item: true } }),
  ]);
  const out: Flag[] = [];

  // 1. Price above the benchmark for that item.
  for (const pr of prs) {
    if (!pr.item || !pr.chosenQuote || !["APPROVED", "ORDERED", "RECEIVED", "PENDING"].includes(pr.status)) continue;
    const q = pr.quotes.find((x) => x.id === pr.chosenQuote); if (!q) continue;
    const unit = Number(q.total) / Math.max(1, pr.qty), bench = Number(pr.item.benchmark);
    if (unit > bench * (1 + LIMITS.overBenchmark)) out.push({
      key: `price-${pr.number}`, level: unit > bench * 1.4 ? "high" : "medium", kind: "Price above benchmark",
      title: `PR-${pr.number}: ${pr.item.name} at ${peso(unit)} each, ${Math.round((unit / bench - 1) * 100)}% above benchmark`,
      why: `Fair price is about ${peso(bench)}. ${q.vendor} quoted ${peso(Number(q.total))} for ${pr.qty}. Ask for a re-quote or pick another vendor.`,
      atStake: Math.round((unit - bench) * pr.qty), href: `/procurement?pr=${pr.number}`,
    });
  }

  // 2. Split purchases: several requests just under the manager's limit, same category, within 14 days.
  const small = prs.filter((p) => p.status !== "REJECTED" && amountOfPr(p) > LIMITS.manager * 0.7 && amountOfPr(p) <= LIMITS.manager);
  const seen = new Set<number>();
  for (const p of small) {
    if (seen.has(p.number)) continue;
    const group = small.filter((x) => x.category === p.category && Math.abs(x.createdAt.getTime() - p.createdAt.getTime()) <= 14 * DAY);
    const total = group.reduce((s, x) => s + amountOfPr(x), 0);
    if (group.length >= 2 && total > LIMITS.manager) {
      group.forEach((x) => seen.add(x.number));
      const vendors = [...new Set(group.map((x) => x.quotes.find((q) => q.id === x.chosenQuote)?.vendor).filter(Boolean))];
      out.push({
        key: `split-${p.number}`, level: "high", kind: "Possible split purchase",
        title: `${group.length} ${p.category.toLowerCase()} requests just under ${peso(LIMITS.manager)} within 14 days (${peso(total)} total)`,
        why: `PR-${group.map((x) => x.number).join(", PR-")}${vendors.length ? `, all from ${vendors.join(" and ")}` : ""}. Together they should have needed 3 quotes and a board signature. Combine future orders into one request.`,
        atStake: Math.round(total * 0.12), href: `/procurement?pr=${p.number}`,
      });
    }
  }

  // 3. Receiving by the same person who requested or approved (should not happen in the app; catches old data).
  for (const p of prs) if (p.receivedBy && (p.receivedBy === p.requester || approvalsOf(p).some((a) => a.name === p.receivedBy))) out.push({
    key: `sod-${p.number}`, level: "high", kind: "Segregation of duties",
    title: `PR-${p.number}: received by ${p.receivedBy}, who also requested or approved it`,
    why: "One person controlled the purchase from start to finish. Do a spot check that the goods are really on site.", atStake: amountOfPr(p), href: `/procurement?pr=${p.number}`,
  });

  // 4. Invoice above the PO.
  for (const p of prs) if (p.invoiceTotal && Number(p.invoiceTotal) > amountOfPr(p) * 1.02) out.push({
    key: `inv-${p.number}`, level: "medium", kind: "Invoice above PO",
    title: `PR-${p.number}: invoice ${peso(Number(p.invoiceTotal))} vs PO ${peso(amountOfPr(p))}`,
    why: "Pay only the PO amount unless the extra was approved in writing.", atStake: Math.round(Number(p.invoiceTotal) - amountOfPr(p)), href: `/procurement?pr=${p.number}`,
  });

  // 5. Same fixture replaced too often for its expected life.
  const byAsset = new Map<string, typeof reps>();
  for (const r of reps) byAsset.set(r.assetId, [...(byAsset.get(r.assetId) ?? []), r]);
  for (const [, list] of byAsset) {
    const a = list[0].asset;
    const lastYear = list.filter((r) => r.doneAt.getTime() >= now - 365 * DAY);
    const expected = Math.max(1, Math.ceil(12 / a.lifeMonths));
    if (lastYear.length >= 3 && lastYear.length > expected * 2) {
      const spent = lastYear.reduce((s, r) => s + Number(r.cost), 0);
      out.push({
        key: `freq-${a.tag}`, level: lastYear.length >= 4 ? "high" : "medium", kind: "Too-frequent replacement",
        title: `${a.name} (${a.location}) replaced ${lastYear.length} times in 12 months`,
        why: `Expected life is ${a.lifeMonths} months, so this should be about ${expected} a year. Either the parts are poor quality, there is an electrical or water fault upstream, or replacements are being logged that didn't happen. ${peso(spent)} spent. Check the fixture on site.`,
        atStake: spent, href: `/inventory?tab=assets&tag=${encodeURIComponent(a.tag)}`,
      });
    }
  }

  // 6. Paid for a part that was still under warranty (one flag per fixture).
  for (const [, list] of byAsset) {
    const a = list[0].asset;
    const missed = list.filter((r, i) => {
      if (Number(r.cost) <= 0 || r.warrantyClaim) return false;
      const prev = list[i - 1];
      // the fixture's own warranty only counts if it was installed before this replacement
      const cover = prev ? prev.newWarrantyTil : a.installedAt.getTime() < r.doneAt.getTime() - DAY ? a.warrantyUntil : null;
      return !!cover && r.doneAt <= cover;
    });
    if (!missed.length) continue;
    const paid = missed.reduce((s, r) => s + Number(r.cost), 0);
    out.push({
      key: `warranty-${a.tag}`, level: paid >= 5000 ? "high" : "medium", kind: "Missed warranty claim",
      title: `${a.name} (${a.location}): paid ${peso(paid)} for ${missed.length > 1 ? `${missed.length} replacements` : "a replacement"} still under warranty`,
      why: `${missed.map((r) => r.doneAt.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "short" })).join(", ")}. The part installed before it was still under warranty. Claim a refund or credit from ${a.vendor ?? "the supplier"}.`,
      atStake: paid, href: `/inventory?tab=assets&tag=${encodeURIComponent(a.tag)}`,
    });
  }

  // 7. Old part not returned to the storeroom.
  const noReturn = reps.filter((r) => !r.oldPartReturned && !r.warrantyClaim && r.doneAt.getTime() >= now - 90 * DAY);
  if (noReturn.length) out.push({
    key: "noreturn", level: noReturn.length >= 3 ? "high" : "medium", kind: "Old part not returned",
    title: `${noReturn.length} replacement${noReturn.length > 1 ? "s" : ""} in 90 days with no old part handed back`,
    why: `${noReturn.slice(0, 3).map((r) => `${r.asset.name} at ${r.asset.location} by ${r.doneBy}`).join("; ")}. The old part is the proof the replacement happened. Ask for it before signing off.`,
    atStake: noReturn.reduce((s, r) => s + Number(r.cost), 0), href: `/inventory?tab=log`,
  });

  // 8. Stock taken out with no work order, and stock-count shortages.
  const loose = moves.filter((m) => m.kind === "ISSUE" && !m.ref);
  if (loose.length) out.push({
    key: "loose", level: "medium", kind: "Stock out with no job",
    title: `${loose.reduce((s, m) => s - m.qty, 0)} items taken from the storeroom without a work order`,
    why: `${loose.slice(0, 3).map((m) => `${-m.qty} ${m.item.uom} ${m.item.name} by ${m.byName}`).join("; ")}. Every item out should name the job it went to.`,
    atStake: loose.reduce((s, m) => s + -m.qty * Number(m.item.benchmark), 0), href: `/inventory?tab=stock`,
  });
  const short = moves.filter((m) => m.kind === "ADJUST" && m.qty < 0);
  if (short.length) out.push({
    key: "short", level: "high", kind: "Stock-count shortage",
    title: `Storeroom count came up short on ${short.length} item${short.length > 1 ? "s" : ""}`,
    why: short.slice(0, 3).map((m) => `${m.item.name}: ${-m.qty} ${m.item.uom} missing`).join("; ") + ". Recount with a second person and check who had the key.",
    atStake: short.reduce((s, m) => s + -m.qty * Number(m.item.benchmark), 0), href: `/inventory?tab=stock`,
  });

  return out.sort((a, b) => (a.level === b.level ? b.atStake - a.atStake : a.level === "high" ? -1 : 1));
}

function amountOfPr(p: { chosenQuote: string | null; quotes: { id: string; total: unknown }[] }) {
  return amountOf({ ...p, requestedBy: "", approvals: [], receivedBy: null, status: "" });
}

/** Money saved this year by the controls: choosing a cheaper quote, and warranty claims instead of paying. */
export async function savingsThisYear() {
  const y = nowManila().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4);
  const since = new Date(`${y}-01-01T00:00:00+08:00`);
  const [prs, claims] = await Promise.all([
    prisma.purchaseRequest.findMany({ where: { createdAt: { gte: since }, status: { in: ["APPROVED", "ORDERED", "RECEIVED"] } }, include: { quotes: true } }),
    prisma.replacement.findMany({ where: { doneAt: { gte: since }, warrantyClaim: true }, include: { asset: true, item: true } }),
  ]);
  let quotes = 0;
  for (const p of prs) {
    const chosen = p.quotes.find((q) => q.id === p.chosenQuote); if (!chosen || p.quotes.length < 2) continue;
    const others = p.quotes.filter((q) => q.id !== chosen.id).map((q) => Number(q.total));
    quotes += Math.max(0, others.reduce((s, v) => s + v, 0) / others.length - Number(chosen.total));
  }
  const warranty = claims.reduce((s, r) => s + Number(r.item?.benchmark ?? r.asset.cost), 0); // what the part would have cost
  return { quotes: Math.round(quotes), warranty: Math.round(warranty), total: Math.round(quotes + warranty), claims: claims.length, compared: prs.filter((p) => p.quotes.length >= 2).length };
}
