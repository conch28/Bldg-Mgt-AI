"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nowManila, peso } from "@/lib/format";
import { photoOk } from "@/lib/image";

const go = (tab: string, q: string) => redirect(`/inventory?tab=${tab}&${q}`);
const msg = (s: string) => encodeURIComponent(s);

const Rep = z.object({
  assetId: z.string().min(5), itemId: z.string().optional(), workOrder: z.string().optional(), doneBy: z.string().trim().min(2).max(80),
  cost: z.coerce.number().min(0).max(5_000_000), warrantyMonths: z.coerce.number().int().min(0).max(120).optional(), note: z.string().trim().max(400).optional(),
});

/** Records a replacement: what, where, when, who, cost and warranty. Takes the part out of stock and resets the fixture's warranty. */
export async function logReplacement(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const p = Rep.safeParse(Object.fromEntries(fd));
  if (!p.success) return go("log", "error=" + msg("Pick the fixture, who replaced it and the cost (0 if under warranty)."));
  const photo = String(fd.get("photo") || "") || null;
  if (!photoOk(photo)) return go("log", "error=" + msg("That photo couldn't be used."));
  const asset = await prisma.asset.findUnique({ where: { id: p.data.assetId } });
  if (!asset) return go("log", "error=" + msg("Fixture not found."));
  const item = p.data.itemId ? await prisma.stockItem.findUnique({ where: { id: p.data.itemId } }) : null;
  if (item && item.onHand < 1) return go("log", "error=" + msg(`${item.name} shows 0 in stock. Receive the delivery first, or leave the stock item blank if the vendor supplied the part.`));
  const wo = p.data.workOrder ? Number(p.data.workOrder.replace(/\D/g, "")) || null : null;
  const warrantyClaim = fd.get("warrantyClaim") === "on";
  const oldPartReturned = fd.get("oldPartReturned") === "on";
  const now = nowManila();
  const til = p.data.warrantyMonths ? new Date(now.getTime() + p.data.warrantyMonths * 30.4 * 86400000) : null;
  await prisma.$transaction(async (tx) => {
    await tx.replacement.create({ data: { assetId: asset.id, itemId: item?.id ?? null, workOrder: wo, doneAt: now, doneBy: p.data.doneBy, loggedBy: u.name, cost: warrantyClaim ? 0 : p.data.cost, warrantyClaim, newWarrantyTil: til, oldPartReturned, photo, note: p.data.note || null } });
    await tx.asset.update({ where: { id: asset.id }, data: { status: "OK", installedAt: now, warrantyUntil: til ?? asset.warrantyUntil } });
    if (item) {
      await tx.stockMove.create({ data: { itemId: item.id, qty: -1, kind: "ISSUE", ref: wo ? `WO-${wo}` : asset.tag, byName: u.name, note: `Replacement at ${asset.location}` } });
      await tx.stockItem.update({ where: { id: item.id }, data: { onHand: { decrement: 1 } } });
      if (oldPartReturned) await tx.stockMove.create({ data: { itemId: item.id, qty: 0, kind: "RETURN", ref: asset.tag, byName: p.data.doneBy, note: "Old part returned for disposal" } });
    }
  });
  await audit(u.id, "replacement", `${asset.tag} ${asset.name} at ${asset.location} by ${p.data.doneBy}, ${warrantyClaim ? "warranty claim" : peso(p.data.cost)}${oldPartReturned ? ", old part returned" : ", OLD PART NOT RETURNED"}`);
  revalidatePath("/inventory"); revalidatePath("/procurement");
  go("log", "ok=" + msg(`Logged. ${asset.name} at ${asset.location} now has ${til ? `a warranty until ${til.toLocaleDateString("en-PH", { month: "short", year: "numeric" })}` : "no warranty on record"}.`));
}

export async function issueStock(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const p = z.object({ itemId: z.string().min(5), qty: z.coerce.number().int().min(1).max(1000), ref: z.string().trim().max(40).optional(), note: z.string().trim().max(200).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return go("stock", "error=" + msg("Pick the item and how many."));
  const item = await prisma.stockItem.findUnique({ where: { id: p.data.itemId } });
  if (!item || item.onHand < p.data.qty) return go("stock", "error=" + msg("Not enough in stock."));
  if (!p.data.ref) return go("stock", "error=" + msg("Name the work order or fixture this is for. Stock out with no job gets flagged."));
  await prisma.$transaction([
    prisma.stockMove.create({ data: { itemId: item.id, qty: -p.data.qty, kind: "ISSUE", ref: p.data.ref, byName: u.name, note: p.data.note || null } }),
    prisma.stockItem.update({ where: { id: item.id }, data: { onHand: { decrement: p.data.qty } } }),
  ]);
  await audit(u.id, "stock issued", `${p.data.qty} ${item.uom} ${item.name} for ${p.data.ref}`);
  revalidatePath("/inventory");
  go("stock", "ok=" + msg(`${p.data.qty} ${item.name} taken out for ${p.data.ref}.`));
}

/** Physical count. A difference is recorded as an adjustment and shortages raise a red flag for the board. */
export async function countStock(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const p = z.object({ itemId: z.string().min(5), counted: z.coerce.number().int().min(0).max(100000) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return go("stock", "error=" + msg("Enter the number you counted."));
  const item = await prisma.stockItem.findUnique({ where: { id: p.data.itemId } });
  if (!item) return go("stock", "error=" + msg("Item not found."));
  const diff = p.data.counted - item.onHand;
  if (diff !== 0) {
    await prisma.$transaction([
      prisma.stockMove.create({ data: { itemId: item.id, qty: diff, kind: "ADJUST", ref: "Count", byName: u.name, note: `Counted ${p.data.counted}, system had ${item.onHand}` } }),
      prisma.stockItem.update({ where: { id: item.id }, data: { onHand: p.data.counted } }),
    ]);
  }
  await audit(u.id, "stock count", `${item.name}: counted ${p.data.counted}, system ${item.onHand}${diff ? ` (${diff > 0 ? "+" : ""}${diff})` : ""}`);
  revalidatePath("/inventory"); revalidatePath("/procurement");
  go("stock", "ok=" + msg(diff === 0 ? `${item.name}: count matches.` : `${item.name}: ${diff < 0 ? `${-diff} short, flagged for the board` : `${diff} extra`}. Stock updated.`));
}
