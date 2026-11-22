"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { photoOk } from "@/lib/image";
import { notifyUser } from "@/lib/comms";
import { runIntegrity } from "@/lib/integrity";

const go = (tab: string, q: string) => redirect(`/integrity?tab=${tab}&${q}`);
const names = (person: string) => person.split(" and ").map((s) => s.trim());

/** Manager records the result of a random spot check. You can't spot-check your own entry. */
export async function checkSpotAudit(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const id = String(fd.get("id") || "");
  const result = fd.get("decision") === "ISSUE" ? "ISSUE" : "PASS";
  const note = String(fd.get("note") || "").trim().slice(0, 600);
  const photo = String(fd.get("photo") || "");
  const a = await prisma.spotAudit.findUnique({ where: { id } });
  if (!a) return go("audits", "error=" + encodeURIComponent("That spot check no longer exists."));
  if (a.checkedAt) return go("audits", "error=" + encodeURIComponent("Already checked."));
  if (names(a.person).includes(u.name)) return go("audits", "error=" + encodeURIComponent("This is your own entry. Ask the operations head to check it."));
  if (result === "ISSUE" && note.length < 5) return go("audits", "error=" + encodeURIComponent("Say what you found, so the person knows what to fix."));
  if (photo && !photoOk(photo)) return go("audits", "error=" + encodeURIComponent("That photo couldn't be used. Try again."));
  await prisma.spotAudit.update({ where: { id }, data: { checkedAt: new Date(), checkedBy: u.name, result, note: note || null, photo: photo || null } });
  if (a.kind === "WO") await prisma.wOEvent.create({ data: { workOrderId: a.refId, author: u.name, note: result === "PASS" ? `Spot check passed.${note ? " " + note : ""}` : `Spot check found a problem: ${note}` } });
  await audit(u.id, "spot_audit", `${a.label} (${a.person}): ${result === "PASS" ? "passed" : "issue: " + note}`);
  if (result === "ISSUE") {
    const guard = await prisma.user.findFirst({ where: { name: a.person, active: true }, select: { id: true } });
    if (guard) await notifyUser(guard.id, "Spot check: something to fix", `${a.label}: ${note}. Please talk to ${u.name} po.`, ["APP"]);
  }
  revalidatePath("/integrity"); revalidatePath("/tasks");
  go("audits", "ok=" + encodeURIComponent(result === "PASS" ? "Marked as passed. Salamat po!" : "Problem logged. Talk to the person and follow up."));
}

/** Clear or confirm a flag. Never about yourself: flags about the manager are reviewed by the operations head. */
export async function reviewFlag(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const id = String(fd.get("id") || "");
  const confirm = fd.get("decision") === "CONFIRM";
  const note = String(fd.get("note") || "").trim().slice(0, 600);
  const explanation = String(fd.get("explanation") || "").trim().slice(0, 600);
  const f = await prisma.entryFlag.findUnique({ where: { id } });
  if (!f || f.status !== "OPEN") return go("flags", "error=" + encodeURIComponent("That flag was already reviewed."));
  if (names(f.person).includes(u.name)) return go("flags", "error=" + encodeURIComponent("This flag is about you, so the operations head reviews it."));
  if (confirm && note.length < 5) return go("flags", "error=" + encodeURIComponent("Write the coaching note: what happened and what to do next time."));
  await prisma.entryFlag.update({ where: { id }, data: { status: confirm ? "CONFIRMED" : "CLEARED", reviewedBy: u.name, reviewedAt: new Date(), reviewNote: note || null, ...(explanation && !f.explanation ? { explanation } : {}) } });
  await audit(u.id, "entry_flag", `${f.title} (${f.person}): ${confirm ? "confirmed" : "cleared"}${note ? ` - ${note}` : ""}`);
  for (const n of names(f.person)) {
    const staff = await prisma.user.findFirst({ where: { name: n, active: true }, select: { id: true } });
    if (staff) await notifyUser(staff.id, confirm ? "Coaching note on your entries" : "Flag cleared", confirm ? `${f.title}. ${note}` : `${f.title}: checked by ${u.name} and cleared. Salamat po!`, ["APP"]);
  }
  revalidatePath("/integrity"); revalidatePath("/tasks");
  go("flags", "ok=" + encodeURIComponent(confirm ? "Confirmed. It now counts in their accuracy score, with your coaching note." : "Cleared. It won't count against anyone."));
}

/** The staff member gives their side before the flag is reviewed. */
export async function explainFlag(fd: FormData) {
  const u = await requireRole("GUARD", "MANAGER", "ADMIN");
  const id = String(fd.get("id") || "");
  const text = String(fd.get("explanation") || "").trim().slice(0, 600);
  const back = String(fd.get("back") || "/tasks").startsWith("/") ? String(fd.get("back") || "/tasks") : "/tasks";
  const f = await prisma.entryFlag.findUnique({ where: { id } });
  if (!f || f.status !== "OPEN" || !names(f.person).includes(u.name)) redirect(back);
  if (text.length < 5) redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent("Write a short explanation first.")}`);
  await prisma.entryFlag.update({ where: { id }, data: { explanation: text } });
  await audit(u.id, "entry_flag", `${u.name} explained: ${f.title}`);
  revalidatePath("/integrity"); revalidatePath("/tasks");
  redirect(`${back}${back.includes("?") ? "&" : "?"}ok=${encodeURIComponent("Thanks po. Your explanation is with the reviewer.")}`);
}

/** Run the checks now instead of waiting for the daily job. */
export async function runChecksNow() {
  const u = await requireRole("MANAGER", "ADMIN");
  const r = await runIntegrity();
  await audit(u.id, "entry_flag", `Ran entry checks: ${r.flags.created} new flags, ${r.audits.drawn} spot checks drawn`);
  revalidatePath("/integrity");
  go("flags", "ok=" + encodeURIComponent(`Checked ${r.flags.found ? "the last 30 days" : "everything"}: ${r.flags.created} new flag${r.flags.created === 1 ? "" : "s"}.`));
}
