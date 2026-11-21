import { prisma } from "./db";

/** Applies a payment to the unit's oldest unpaid bills first. */
export async function applyPayment(unitId: string, amount: number, method: string, reference: string) {
  const bills = await prisma.bill.findMany({ where: { unitId, status: { not: "PAID" } }, orderBy: { period: "asc" } });
  let left = amount;
  await prisma.$transaction(async (tx) => {
    for (const b of bills) {
      if (left <= 0) break;
      const due = Number(b.amount) - Number(b.paid); const pay = Math.min(due, left); left -= pay;
      const paid = Number(b.paid) + pay;
      await tx.bill.update({ where: { id: b.id }, data: { paid, status: paid >= Number(b.amount) ? "PAID" : "PARTIAL" } });
      await tx.payment.create({ data: { billId: b.id, amount: pay, method, reference } });
    }
  });
  return amount - left;
}
