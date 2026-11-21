import { NextResponse } from "next/server";
import { currentUser, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";

/** Data Privacy Act right to data portability: everything we hold about the signed-in person, as JSON. */
export async function GET() {
  const u = await currentUser();
  if (!u) return new NextResponse("Sign in first", { status: 401 });
  if (!(await rateLimit(`export:${u.id}`, 5, 3600)).ok) return new NextResponse("Too many downloads. Try again in an hour.", { status: 429 });
  const data = await prisma.user.findUnique({
    where: { id: u.id },
    select: {
      name: true, email: true, phone: true, role: true, language: true, notifySms: true, notifyEmail: true, notifyMessenger: true, consentAt: true, createdAt: false,
      units: { select: { code: true, floor: true, sqm: true, bills: { select: { period: true, amount: true, paid: true, dueDate: true, status: true, payments: { select: { amount: true, method: true, reference: true, createdAt: true } } } } } },
      workOrders: { select: { number: true, title: true, description: true, status: true, rating: true, createdAt: true } },
      chat: { select: { role: true, content: true, createdAt: true } },
      bookings: { select: { slot: true, qty: true, total: true, status: true } },
      amenityBookings: { select: { start: true, end: true, status: true } },
      passes: { select: { kind: true, name: true, plate: true, validFrom: true, validTo: true } },
      votes: { select: { createdAt: true, poll: { select: { question: true } }, option: { select: { label: true } } } },
      pulses: { select: { kind: true, score: true, comment: true, createdAt: true } },
      listings: { select: { kind: true, status: true, price: true, title: true, createdAt: true, _count: { select: { inquiries: true } } } },
      moves: { select: { kind: true, date: true, status: true } },
      registrations: { select: { kind: true, name: true, status: true, createdAt: true } },
      marketItems: { select: { title: true, price: true, status: true, createdAt: true } },
      lostFound: { select: { kind: true, title: true, status: true, createdAt: true } },
      sosAlerts: { select: { kind: true, status: true, createdAt: true } },
      privacyRequests: { select: { kind: true, status: true, note: true, reply: true, createdAt: true } },
      audit: { select: { action: true, detail: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 500 },
    },
  });
  await audit(u.id, "privacy_export", "Downloaded own data");
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2), {
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="my-skyland-data.json"` },
  });
}
