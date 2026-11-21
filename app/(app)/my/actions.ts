"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { headers } from "next/headers";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { applyPayment } from "@/lib/billing";
import { createCheckout, paymongoEnabled, testPaymentsAllowed } from "@/lib/payments";
import { peso } from "@/lib/format";

export async function payBalance(fd: FormData) {
  const u = await requireRole("OWNER");
  const unitId = z.string().parse(fd.get("unitId"));
  const unit = await prisma.unit.findFirst({ where: { id: unitId, ownerId: u.id } });
  if (!unit) throw new Error("Not your unit");
  const bills = await prisma.bill.findMany({ where: { unitId, status: { not: "PAID" } } });
  const due = bills.reduce((s, b) => s + Number(b.amount) - Number(b.paid), 0);
  if (due <= 0) return;
  if (paymongoEnabled()) {
    const origin = process.env.NEXTAUTH_URL ?? `https://${headers().get("host")}`;
    const url = await createCheckout({ amount: due, description: `Skyland dues, Unit ${unit.code}`, reference: `unit:${unit.id}`, successUrl: `${origin}/my?paid=1`, cancelUrl: `${origin}/my`, email: u.email });
    redirect(url);
  }
  if (!testPaymentsAllowed()) throw new Error("Online payments are not configured yet.");
  const method = z.enum(["GCash", "Maya", "Card"]).parse(fd.get("method") ?? "GCash");
  await applyPayment(unitId, due, method, `TEST-${Date.now()}`);
  await audit(u.id, "payment", `Unit ${unit.code} paid ${peso(due)} via ${method} (test mode)`);
  revalidatePath("/my");
  redirect("/my?paid=1");
}

export async function rateWorkOrder(fd: FormData) {
  const u = await requireRole("OWNER");
  const p = z.object({ id: z.string(), rating: z.coerce.number().int().min(1).max(5) }).parse(Object.fromEntries(fd));
  await prisma.workOrder.updateMany({ where: { id: p.id, reporterId: u.id, status: "DONE" }, data: { rating: p.rating } });
  revalidatePath("/my");
}
