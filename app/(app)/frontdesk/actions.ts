"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nowManila } from "@/lib/format";
import { notifyUser } from "@/lib/comms";

export async function checkPass(fd: FormData) {
  const u = await requireRole("GUARD", "MANAGER", "ADMIN");
  const code = String(fd.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^SKYLANDPASS/, "");
  const action = String(fd.get("action") || "lookup");
  const pass = code ? await prisma.pass.findUnique({ where: { code }, include: { unit: true } }) : null;
  if (!pass) redirect("/frontdesk?error=" + encodeURIComponent(`No pass found for "${code}". Call the unit to confirm.`));
  const now = nowManila();
  if (action === "in") {
    if (pass.validFrom > now || pass.validTo < now) redirect(`/frontdesk?code=${code}&error=` + encodeURIComponent("This pass is not valid right now."));
    await prisma.pass.update({ where: { id: pass.id }, data: { checkedIn: now } });
    await audit(u.id, "visitor in", `${pass.code} ${pass.name} → ${pass.unit.code}`);
    await notifyUser(pass.userId, pass.kind === "DELIVERY" ? "Your delivery is at the lobby" : `${pass.name} has arrived`, pass.kind === "DELIVERY" ? `${pass.name} is at the lobby with your delivery (pass ${pass.code}).` : `${pass.name} checked in at the lobby and is on the way to Unit ${pass.unit.code}.`, ["APP", "SMS"]);
  } else if (action === "out") {
    await prisma.pass.update({ where: { id: pass.id }, data: { checkedOut: now } });
    await audit(u.id, "visitor out", `${pass.code} ${pass.name}`);
  }
  revalidatePath("/frontdesk");
  redirect(`/frontdesk?code=${code}${action !== "lookup" ? `&ok=${action}` : ""}`);
}
