"use server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
export async function changePassword(_: unknown, fd: FormData) {
  const u = await requireRole();
  const p = z.object({ current: z.string(), next: z.string().min(10, "Use at least 10 characters.") }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await bcrypt.compare(p.data.current, user.passwordHash))) return { error: "Your current password is not correct." };
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(p.data.next, 10) } });
  await audit(u.id, "password_change");
  return { ok: "Password changed." };
}
