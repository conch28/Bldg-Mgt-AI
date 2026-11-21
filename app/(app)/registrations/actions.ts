"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/lib/comms";

export async function register(fd: FormData) {
  const u = await requireRole("OWNER");
  const p = z.object({ kind: z.enum(["PET", "VEHICLE"]), name: z.string().trim().min(2).max(60), details: z.string().trim().min(2).max(160) }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/registrations?error=" + encodeURIComponent("Fill in the name and details."));
  const unit = await prisma.unit.findFirst({ where: { ownerId: u.id }, orderBy: { code: "asc" } });
  if (!unit) redirect("/registrations");
  await prisma.registration.create({ data: { ...p.data, name: p.data.kind === "VEHICLE" ? p.data.name.toUpperCase() : p.data.name, unitId: unit.id, userId: u.id } });
  await audit(u.id, "registration submitted", `${p.data.kind} ${p.data.name}`);
  revalidatePath("/registrations");
  redirect("/registrations?sent=1");
}

export async function decide(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const r = await prisma.registration.findUnique({ where: { id: String(fd.get("id")) } });
  const ok = fd.get("ok") === "1";
  if (!r) redirect("/registrations");
  const sticker = ok ? `${r.kind === "PET" ? "P" : "V"}-${String(1000 + (await prisma.registration.count({ where: { kind: r.kind, status: "APPROVED" } })) + 1)}` : null;
  await prisma.registration.update({ where: { id: r.id }, data: { status: ok ? "APPROVED" : "REJECTED", sticker } });
  await notifyUser(r.userId, ok ? `${r.kind === "PET" ? "Pet" : "Vehicle"} registration approved` : "Registration needs more details", ok ? `${r.name} is registered. Sticker ${sticker} is ready at the admin office.` : `Please check the details for ${r.name} with the admin office.`, ["APP"]);
  await audit(u.id, ok ? "registration approved" : "registration rejected", `${r.kind} ${r.name}`);
  revalidatePath("/registrations");
  redirect("/registrations");
}
