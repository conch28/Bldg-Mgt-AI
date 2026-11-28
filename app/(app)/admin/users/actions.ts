"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Nobody signs in with a password: accounts get a random, never-shown one because the column is required.
const tempPassword = () => crypto.randomBytes(24).toString("base64url");

export async function createUser(_: unknown, fd: FormData) {
  const a = await requireRole("ADMIN");
  const p = z.object({ name: z.string().min(2).max(80), email: z.string().email(), role: z.enum(["OWNER", "BOARD", "MANAGER", "ADMIN"]), phone: z.string().max(30).optional(), unit: z.string().max(10).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Check the name, email and role." };
  const email = p.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return { error: "That email already has an account." };
  const pw = tempPassword();
  const user = await prisma.user.create({ data: { name: p.data.name, email, role: p.data.role, phone: p.data.phone || null, passwordHash: await bcrypt.hash(pw, 10), buildingId: a.buildingId } });
  if (p.data.unit) {
    const unit = await prisma.unit.findFirst({ where: { code: p.data.unit.toUpperCase().trim(), buildingId: a.buildingId } });
    if (unit) await prisma.unit.update({ where: { id: unit.id }, data: { ownerId: user.id, ownerName: user.name } });
  }
  await audit(a.id, "user_create", `Created ${p.data.role.toLowerCase()} ${email}`);
  revalidatePath("/admin/users");
  return { ok: `Account created for ${email}. They sign in with a one-time code sent to their email or mobile. No password needed.` };
}

export async function toggleActive(fd: FormData) {
  const a = await requireRole("ADMIN");
  const id = z.string().parse(fd.get("id"));
  if (id === a.id) return;
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { active: !u.active } });
  await audit(a.id, "user_toggle", `${u.active ? "Deactivated" : "Reactivated"} ${u.email}`);
  revalidatePath("/admin/users");
}
