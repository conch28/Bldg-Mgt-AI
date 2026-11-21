"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nowManila, peso } from "@/lib/format";
import { approvalsOf, approvalProgress, canApprove, canReceive, ruleFor, type Approval } from "@/lib/procurement";
import { photoOk } from "@/lib/image";
import { notifyUser } from "@/lib/comms";

const go = (q: string) => redirect("/procurement?" + q);
const err = (pr: number | string, m: string) => go(`pr=${pr}&error=${encodeURIComponent(m)}`);
const money = z.coerce.number().positive().max(50_000_000);

async function load(number: number) {
  const pr = await prisma.purchaseRequest.findUnique({ where: { number }, include: { quotes: true, item: true } });
  if (!pr) go("error=" + encodeURIComponent("Request not found."));
  return pr!;
}
const prNo = (fd: FormData) => z.coerce.number().int().positive().parse(fd.get("pr"));

/** Tells the people who still need to sign that a request is waiting for them. */
async function nudgeApprovers(number: number, title: string, amount: number) {
  const rule = ruleFor(amount);
  const roles = [...(rule.manager ? ["MANAGER" as const] : []), ...(rule.board ? ["BOARD" as const] : [])];
  const people = await prisma.user.findMany({ where: { role: { in: roles }, active: true }, select: { id: true } });
  await Promise.all(people.map((p) => notifyUser(p.id, `Approval needed: PR-${number}`, `${title}, ${peso(amount)}. Open Procurement to review the quotes.`, ["APP"])));
}

const New = z.object({
  title: z.string().trim().min(3).max(120), category: z.string().trim().min(2).max(40), reason: z.string().trim().min(5).max(800),
  qty: z.coerce.number().int().min(1).max(10000), itemId: z.string().optional(), workOrder: z.string().optional(), chosen: z.string().optional(), chooseNote: z.string().trim().max(400).optional(),
});

export async function createRequest(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const p = New.safeParse(Object.fromEntries(fd));
  if (!p.success) return go("new=1&error=" + encodeURIComponent("Fill in what you need, the quantity and why."));
  const quotes = [0, 1, 2].map((i) => ({ vendor: String(fd.get(`v${i}`) || "").trim().slice(0, 80), total: Number(String(fd.get(`t${i}`) || "").replace(/[,₱\s]/g, "")) }))
    .filter((q) => q.vendor && q.total > 0 && q.total < 50_000_000);
  if (!quotes.length) return go("new=1&error=" + encodeURIComponent("Add at least one quote: vendor and total price."));
  const item = p.data.itemId ? await prisma.stockItem.findUnique({ where: { id: p.data.itemId } }) : null;
  const wo = p.data.workOrder ? Number(p.data.workOrder.replace(/\D/g, "")) || null : null;
  const lowest = quotes.reduce((m, q, i) => (q.total < quotes[m].total ? i : m), 0);
  const chosenIdx = Math.min(quotes.length - 1, Math.max(0, Number(p.data.chosen ?? lowest) || 0));
  if (chosenIdx !== lowest && !p.data.chooseNote) return go("new=1&error=" + encodeURIComponent("You picked a quote that isn't the cheapest. Say why (for example: faster delivery, warranty)."));
  const rule = ruleFor(quotes[chosenIdx].total);
  const enough = quotes.length >= rule.quotes;

  const pr = await prisma.purchaseRequest.create({ data: {
    title: p.data.title, category: p.data.category, reason: p.data.reason, qty: p.data.qty, itemId: item?.id ?? null, workOrder: wo,
    requestedBy: u.id, requester: u.name, status: enough ? "PENDING" : "QUOTING", chooseNote: chosenIdx !== lowest ? p.data.chooseNote : null,
    quotes: { create: quotes.map((q) => ({ vendor: q.vendor, total: q.total, addedBy: u.name })) },
  }, include: { quotes: true } });
  const chosen = pr.quotes.find((q) => q.vendor === quotes[chosenIdx].vendor && Number(q.total) === quotes[chosenIdx].total);
  await prisma.purchaseRequest.update({ where: { id: pr.id }, data: { chosenQuote: chosen?.id } });
  await audit(u.id, "purchase request", `PR-${pr.number} ${pr.title}, ${peso(quotes[chosenIdx].total)} (${quotes.length} quote${quotes.length > 1 ? "s" : ""})`);
  if (enough) await nudgeApprovers(pr.number, pr.title, quotes[chosenIdx].total);
  revalidatePath("/procurement");
  go(`pr=${pr.number}&ok=` + encodeURIComponent(enough ? "Sent for approval." : `Saved. This amount needs ${rule.quotes} quotes before it can go for approval.`));
}

export async function addQuote(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const n = prNo(fd); const pr = await load(n);
  if (pr.status !== "QUOTING") return err(n, "Quotes can only be added before approval.");
  const vendor = String(fd.get("vendor") || "").trim().slice(0, 80);
  const total = money.safeParse(String(fd.get("total") || "").replace(/[,₱\s]/g, ""));
  if (!vendor || !total.success) return err(n, "Add the vendor and total price.");
  if (pr.quotes.some((q) => q.vendor.toLowerCase() === vendor.toLowerCase())) return err(n, "That vendor already quoted. Quotes must come from different vendors.");
  await prisma.quote.create({ data: { requestId: pr.id, vendor, total: total.data, addedBy: u.name } });
  await audit(u.id, "purchase request", `PR-${n}: quote from ${vendor}, ${peso(total.data)}`);
  revalidatePath("/procurement");
  go(`pr=${n}`);
}

export async function submitForApproval(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const n = prNo(fd); const pr = await load(n);
  if (pr.status !== "QUOTING") return err(n, "Already submitted.");
  const chosen = pr.quotes.find((q) => q.id === fd.get("chosen")) ?? pr.quotes.sort((a, b) => Number(a.total) - Number(b.total))[0];
  if (!chosen) return err(n, "Add a quote first.");
  const lowest = Math.min(...pr.quotes.map((q) => Number(q.total)));
  const note = String(fd.get("chooseNote") || "").trim().slice(0, 400);
  if (Number(chosen.total) > lowest && !note) return err(n, "You picked a quote that isn't the cheapest. Say why.");
  const rule = ruleFor(Number(chosen.total));
  if (pr.quotes.length < rule.quotes) return err(n, `This amount needs ${rule.quotes} quotes from different vendors (${pr.quotes.length} so far).`);
  await prisma.purchaseRequest.update({ where: { id: pr.id }, data: { status: "PENDING", chosenQuote: chosen.id, chooseNote: Number(chosen.total) > lowest ? note : null } });
  await audit(u.id, "purchase request", `PR-${n} sent for approval, ${chosen.vendor} ${peso(Number(chosen.total))}`);
  await nudgeApprovers(n, pr.title, Number(chosen.total));
  revalidatePath("/procurement");
  go(`pr=${n}&ok=Sent+for+approval.`);
}

export async function approve(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN", "BOARD");
  const n = prNo(fd); const pr = await load(n);
  const c = canApprove(pr, u);
  if (!c.ok) return err(n, c.why!);
  const approvals: Approval[] = [...approvalsOf(pr), { id: u.id, name: u.name, role: u.role, at: nowManila().toISOString() }];
  const done = approvalProgress({ ...pr, approvals }).done;
  await prisma.purchaseRequest.update({ where: { id: pr.id }, data: { approvals, status: done ? "APPROVED" : "PENDING" } });
  await audit(u.id, "purchase approval", `PR-${n} approved by ${u.name}${done ? " (fully approved)" : ""}`);
  if (done) await notifyUser(pr.requestedBy, `PR-${n} approved`, `${pr.title} is approved. You can issue the purchase order.`, ["APP"]);
  revalidatePath("/procurement");
  go(`pr=${n}&ok=` + encodeURIComponent(done ? "Approved. The manager can now issue the PO." : "Your approval is recorded. Waiting for the next signature."));
}

export async function reject(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN", "BOARD");
  const n = prNo(fd); const pr = await load(n);
  if (!["QUOTING", "PENDING"].includes(pr.status)) return err(n, "Too late to reject.");
  if (pr.requestedBy === u.id) return err(n, "You can't reject your own request. Edit it instead.");
  const note = String(fd.get("note") || "").trim().slice(0, 400);
  if (!note) return err(n, "Say why, so the requester can fix it.");
  await prisma.purchaseRequest.update({ where: { id: pr.id }, data: { status: "REJECTED", rejectNote: `${note} (${u.name})` } });
  await audit(u.id, "purchase approval", `PR-${n} rejected by ${u.name}: ${note}`);
  revalidatePath("/procurement");
  go(`pr=${n}&ok=Rejected.`);
}

export async function issuePO(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const n = prNo(fd); const pr = await load(n);
  if (pr.status !== "APPROVED") return err(n, "Only approved requests can be ordered.");
  const po = `PO-${nowManila().getFullYear()}-${String(n).padStart(4, "0")}`;
  await prisma.purchaseRequest.update({ where: { id: pr.id }, data: { status: "ORDERED", poNumber: po, orderedAt: nowManila() } });
  const q = pr.quotes.find((x) => x.id === pr.chosenQuote);
  await audit(u.id, "purchase order", `${po} to ${q?.vendor ?? "vendor"}, ${peso(Number(q?.total ?? 0))}`);
  revalidatePath("/procurement");
  go(`pr=${n}&ok=` + encodeURIComponent(`${po} issued. Someone other than you or the approvers must receive the delivery.`));
}

export async function receive(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN", "GUARD");
  const n = prNo(fd); const pr = await load(n);
  const c = canReceive(pr, u.id);
  if (!c.ok) return err(n, c.why!);
  const qty = z.coerce.number().int().min(0).max(100000).safeParse(fd.get("qty"));
  const inv = String(fd.get("invoice") || "").replace(/[,₱\s]/g, "");
  const photo = String(fd.get("photo") || "") || null;
  if (!qty.success) return err(n, "Count what arrived and enter the quantity.");
  if (!photo) return err(n, "Take a photo of the delivery and the delivery receipt.");
  if (!photoOk(photo)) return err(n, "That photo couldn't be used. Try again.");
  const invoice = inv ? Number(inv) : null;
  const note = String(fd.get("note") || "").trim().slice(0, 400) || null;
  const q = pr.quotes.find((x) => x.id === pr.chosenQuote);
  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({ where: { id: pr.id }, data: { status: "RECEIVED", receivedAt: nowManila(), receivedBy: u.name, receivedQty: qty.data, receivedNote: note, receivedPic: photo, invoiceTotal: invoice && isFinite(invoice) ? invoice : null } });
    if (pr.itemId && qty.data > 0) {
      await tx.stockMove.create({ data: { itemId: pr.itemId, qty: qty.data, kind: "RECEIVE", ref: pr.poNumber ?? `PR-${n}`, byName: u.name, note } });
      await tx.stockItem.update({ where: { id: pr.itemId }, data: { onHand: { increment: qty.data }, lastPrice: q ? Number(q.total) / Math.max(1, pr.qty) : undefined } });
    }
  });
  const short = qty.data < pr.qty;
  await audit(u.id, "goods received", `${pr.poNumber ?? `PR-${n}`}: ${qty.data} of ${pr.qty} received by ${u.name}${invoice ? `, invoice ${peso(invoice)}` : ""}`);
  if (short) await notifyUser(pr.requestedBy, `Short delivery on ${pr.poNumber}`, `${qty.data} of ${pr.qty} arrived. Don't pay the full invoice until the rest comes.`, ["APP"]);
  revalidatePath("/procurement"); revalidatePath("/inventory");
  go(`pr=${n}&ok=` + encodeURIComponent(short ? `Received ${qty.data} of ${pr.qty}. The requester has been told it's short.` : "Received and added to stock."));
}
