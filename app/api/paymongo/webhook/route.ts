import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWebhook } from "@/lib/payments";
import { applyPayment } from "@/lib/billing";
import { audit } from "@/lib/auth";

// PayMongo calls this after a successful checkout. reference_number = "unit:<unitId>".
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("paymongo-signature"))) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  const evt = JSON.parse(raw)?.data?.attributes;
  if (evt?.type !== "checkout_session.payment.paid") return NextResponse.json({ ok: true });
  const cs = evt.data?.attributes; const ref: string = cs?.reference_number ?? "";
  const unitId = ref.startsWith("unit:") ? ref.slice(5) : null;
  const pay = cs?.payments?.[0]; const amount = (pay?.attributes?.amount ?? 0) / 100;
  if (!unitId || !amount) return NextResponse.json({ error: "missing reference" }, { status: 400 });
  const payRef = pay.id as string;
  if (await prisma.payment.findFirst({ where: { reference: payRef } })) return NextResponse.json({ ok: true, duplicate: true });
  const method = pay?.attributes?.source?.type === "gcash" ? "GCash" : pay?.attributes?.source?.type === "paymaya" ? "Maya" : "Card";
  await applyPayment(unitId, amount, method, payRef);
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  await audit(unit?.ownerId ?? null, "payment", `Unit ${unit?.code} paid ₱${amount.toLocaleString("en-PH")} via ${method}`);
  return NextResponse.json({ ok: true });
}
