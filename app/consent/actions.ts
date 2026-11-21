"use server";
import { redirect } from "next/navigation";
import { requireRole, audit, homeFor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NOTICE_VERSION } from "@/lib/privacy";

export async function acceptNotice(fd: FormData) {
  const u = await requireRole();
  if (fd.get("agree") !== "on") redirect("/consent?need=1");
  await prisma.user.update({ where: { id: u.id }, data: { consentAt: new Date() } });
  await audit(u.id, "privacy_consent", `Accepted privacy notice ${NOTICE_VERSION}`);
  redirect(homeFor(u.role));
}
