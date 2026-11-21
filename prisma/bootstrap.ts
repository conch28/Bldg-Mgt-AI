/**
 * Production first run (DEMO_MODE off). Creates the building and the first admin login, plus a starter
 * amenity and service list the admin can edit. No sample residents, bills or messages.
 * Runs on every deploy and only creates what is missing.
 *   ADMIN_EMAIL (required), ADMIN_NAME, ADMIN_MOBILE, BUILDING_NAME, BUILDING_CITY, DUES_RATE
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();
async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  if (!email) { console.log("Production bootstrap skipped: set ADMIN_EMAIL in Vercel to create the first admin login."); return; }
  let b = await prisma.building.findFirst();
  if (!b) {
    b = await prisma.building.create({ data: { name: process.env.BUILDING_NAME || "Skyland Plaza", city: process.env.BUILDING_CITY || "Makati", duesRate: Number(process.env.DUES_RATE || 85) } });
    console.log(`Created building ${b.name}.`);
  }
  if (!(await prisma.user.findUnique({ where: { email } }))) {
    await prisma.user.create({ data: { email, name: process.env.ADMIN_NAME || "Building admin", phone: process.env.ADMIN_MOBILE || null, role: "ADMIN", buildingId: b.id, passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10) } });
    console.log(`Created admin login ${email.replace(/^(.).*@/, "$1•••@")}. Sign in with a one-time code.`);
  }
  if ((await prisma.amenity.count()) === 0) await prisma.amenity.createMany({ data: [
    { name: "Swimming pool", detail: "Ask the admin office for details", capacity: 30, openHour: 6, closeHour: 21, slotHours: 2, closedDow: 1 },
    { name: "Function room", detail: "Ask the admin office for details", capacity: 60, fee: 3500, openHour: 9, closeHour: 22, slotHours: 4 },
    { name: "Gym", detail: "Ask the admin office for details", capacity: 12, openHour: 5, closeHour: 23, slotHours: 1 },
  ] });
  if ((await prisma.service.count()) === 0) await prisma.service.createMany({ data: [
    { name: "Aircon cleaning", detail: "Split-type chemical wash", price: 1200, unitLabel: "per aircon", vendor: "Accredited partner" },
    { name: "Plumbing check", detail: "Leak test, faucets, drains", price: 650, unitLabel: "per visit", vendor: "In-house technician" },
    { name: "Deep cleaning", detail: "2 cleaners, 4 hours", price: 2800, unitLabel: "up to 50 sqm", vendor: "Accredited partner" },
  ] });
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
