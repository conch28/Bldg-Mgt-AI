"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";

const d = (s?: string) => (s ? new Date(s + "T00:00:00+08:00") : null);
export async function saveVendor(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const p = z.object({ id: z.string().optional(), name: z.string().trim().min(2), service: z.string().trim().min(2), contact: z.string().optional(), phone: z.string().optional(), monthlyValue: z.coerce.number().min(0), contractEnd: z.string().optional(), insuranceExpiry: z.string().optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/vendors?error=" + encodeURIComponent("Add a name, service and monthly value."));
  const { id, contractEnd, insuranceExpiry, ...rest } = p.data;
  const data = { ...rest, contractEnd: d(contractEnd), insuranceExpiry: d(insuranceExpiry) };
  if (id) await prisma.vendor.update({ where: { id }, data }); else await prisma.vendor.create({ data: { ...data, contractStart: new Date() } });
  await audit(u.id, id ? "vendor updated" : "vendor added", rest.name);
  revalidatePath("/vendors");
  redirect("/vendors?ok=Saved.");
}
