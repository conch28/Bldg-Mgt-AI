/**
 * Demo data for data-entry accountability: acknowledgement times, after photos, manager
 * verification, job links, approval timestamps, receipts and payments. Mostly on time,
 * with a few late or missing records so My tasks and the Accountability page have something to show.
 */
import type { PrismaClient, User } from "@prisma/client";
import { randomBytes } from "node:crypto";

type Ctx = { prisma: PrismaClient; rnd: () => number; manager: User; admin: User; NOW: Date };
const MIN = 60000, H = 3600000;

/** Simple drawn "after photo" so the demo has proof images without shipping real photos. */
function afterPhoto(label: string, hue: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="hsl(${hue},25%,86%)"/><rect x="40" y="40" width="240" height="150" rx="12" fill="hsl(${hue},20%,96%)" stroke="hsl(${hue},25%,60%)" stroke-width="4"/><circle cx="250" cy="70" r="18" fill="#2f8a4e"/><path d="M241 70l6 6 12-12" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/><text x="160" y="125" font-family="Arial" font-size="18" text-anchor="middle" fill="#14231f">${label.replace(/[<&>]/g, "").slice(0, 26)}</text><text x="160" y="215" font-family="Arial" font-size="13" text-anchor="middle" fill="#5b6b67">After photo</text></svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}
function receiptPhoto(vendor: string, amount: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320"><rect width="240" height="320" fill="#f4f1ea"/><text x="120" y="40" font-family="Courier New" font-size="14" text-anchor="middle">${vendor.replace(/[<&>]/g, "").slice(0, 22)}</text><text x="120" y="62" font-family="Courier New" font-size="11" text-anchor="middle">OFFICIAL RECEIPT</text><line x1="20" y1="80" x2="220" y2="80" stroke="#999" stroke-dasharray="4"/><text x="20" y="260" font-family="Courier New" font-size="14">TOTAL</text><text x="220" y="260" font-family="Courier New" font-size="14" text-anchor="end">P${Math.round(amount).toLocaleString("en-PH")}</text></svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

export async function seedV6({ prisma, rnd, manager, admin, NOW }: Ctx) {
  console.log("Accountability: acknowledgements, after photos, verification…");
  const wos = await prisma.workOrder.findMany({ orderBy: { createdAt: "asc" } });
  const doneRecent = wos.filter((w) => w.status === "DONE" && w.closedAt).sort((a, b) => b.closedAt!.getTime() - a.closedAt!.getTime());
  const leaveUnverified = new Set(doneRecent.slice(0, 2).map((w) => w.id));
  for (const w of wos) {
    const data: Record<string, unknown> = {};
    if (w.status !== "NEW") {
      const late = rnd() < 0.12;
      data.ackAt = new Date(w.createdAt.getTime() + (late ? 70 + rnd() * 120 : 8 + rnd() * 45) * MIN);
      data.ackBy = manager.name;
    }
    if (w.status !== "DONE" && w.assignee) data.jobToken = randomBytes(18).toString("base64url");
    if (w.status === "DONE" && w.closedAt) {
      data.doneBy = w.assignee ?? "Rudy M.";
      if (rnd() < 0.9 || leaveUnverified.has(w.id)) data.donePhoto = afterPhoto(w.title, Math.floor(rnd() * 360));
      if (!leaveUnverified.has(w.id) && w.closedAt.getTime() < NOW.getTime() - 4 * H) {
        const late = rnd() < 0.08;
        data.verifiedAt = new Date(Math.min(NOW.getTime() - MIN, w.closedAt.getTime() + (late ? 30 + rnd() * 20 : 1 + rnd() * 18) * H));
        data.verifiedBy = manager.name;
      }
    }
    if (Object.keys(data).length) await prisma.workOrder.update({ where: { id: w.id }, data });
  }

  console.log("Accountability: approvals, receipts and payments…");
  const prs = await prisma.purchaseRequest.findMany({ include: { quotes: true }, orderBy: { createdAt: "asc" } });
  const received = prs.filter((p) => p.status === "RECEIVED" && p.receivedAt).sort((a, b) => b.receivedAt!.getTime() - a.receivedAt!.getTime());
  const awaitingReceipt = received[0]?.id;
  for (const p of prs) {
    const data: Record<string, unknown> = {};
    if (p.status !== "QUOTING") data.submittedAt = p.createdAt;
    if (p.status === "RECEIVED" && p.receivedAt && p.id !== awaitingReceipt) {
      const q = p.quotes.find((x) => x.id === p.chosenQuote) ?? p.quotes[0];
      const amt = Number(p.invoiceTotal ?? q?.total ?? 0);
      data.receiptPic = receiptPhoto(q?.vendor ?? "Vendor", amt);
      data.invoiceTotal = amt;
      if (p.receivedAt.getTime() < NOW.getTime() - 3 * 86400000) {
        data.status = "PAID"; data.paidAt = new Date(p.receivedAt.getTime() + (2 + rnd() * 5) * 86400000); data.paidBy = p.requestedBy === admin.id ? manager.name : admin.name;
        data.paidRef = `BDO-CHK ${String(100200 + Math.floor(rnd() * 800)).padStart(6, "0")}`;
      }
    }
    if (Object.keys(data).length) await prisma.purchaseRequest.update({ where: { id: p.id }, data });
  }

  // Board reports were published on the 3rd of the following month.
  for (const r of await prisma.report.findMany()) {
    const [y, m] = r.period.split("-").map(Number);
    const at = new Date(Date.UTC(y, m, 3, 2, 30)); // 3rd of next month, 10:30 AM Manila
    if (at < NOW) await prisma.report.update({ where: { id: r.id }, data: { createdAt: at } });
  }
}
