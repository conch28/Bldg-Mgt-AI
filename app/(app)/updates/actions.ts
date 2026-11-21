"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function markAllRead() {
  const u = await requireRole("OWNER");
  await prisma.delivery.updateMany({ where: { userId: u.id, channel: "APP", readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}
