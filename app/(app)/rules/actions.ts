"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ruleById } from "@/lib/houserules";

const back = (m: string, id?: string) => redirect(`/rules?ok=${encodeURIComponent(m)}${id ? `#${id}` : ""}`);

/** Board or manager edits a rule's wording. An edit puts an approved rule back to "template" until the board approves it again. */
export async function saveRule(fd: FormData) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const p = z.object({ id: z.string().regex(/^hr-[\d-]+$/), title: z.string().trim().min(3).max(120), text: z.string().trim().min(10).max(2000) }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/rules?error=" + encodeURIComponent("A rule needs a title and at least a sentence."));
  const r = await prisma.houseRule.findUnique({ where: { id: p.data.id } });
  if (!r) redirect("/rules?error=Rule+not+found");
  if (r.title === p.data.title && r.text === p.data.text) back("No changes.", r.id);
  await prisma.houseRule.update({ where: { id: r.id }, data: { title: p.data.title, text: p.data.text, editedBy: u.name, status: "TEMPLATE", approvedBy: null, approvedAt: null } });
  await audit(u.id, "house rule edited", `§${r.section} ${p.data.title}`);
  revalidatePath("/rules");
  back(`§${r.section} saved. It shows as draft until the board approves it.`, r.id);
}

/** Board marks a rule as approved (e.g. after a board resolution). */
export async function approveRule(fd: FormData) {
  const u = await requireRole("BOARD", "ADMIN");
  const r = await prisma.houseRule.findUnique({ where: { id: String(fd.get("id")) } });
  if (!r) redirect("/rules?error=Rule+not+found");
  const ok = r.status !== "APPROVED";
  await prisma.houseRule.update({ where: { id: r.id }, data: ok ? { status: "APPROVED", approvedBy: u.name, approvedAt: new Date() } : { status: "TEMPLATE", approvedBy: null, approvedAt: null } });
  await audit(u.id, ok ? "house rule approved" : "house rule approval withdrawn", `§${r.section} ${r.title}`);
  revalidatePath("/rules");
  back(ok ? `§${r.section} approved.` : `§${r.section} back to draft.`, r.id);
}

/** Puts the best-practice template text back. */
export async function resetRule(fd: FormData) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const t = ruleById(String(fd.get("id")));
  if (!t) redirect("/rules?error=Rule+not+found");
  await prisma.houseRule.update({ where: { id: t.id }, data: { title: t.title, text: t.text, status: "TEMPLATE", editedBy: u.name, approvedBy: null, approvedAt: null } });
  await audit(u.id, "house rule reset to template", `§${t.section} ${t.title}`);
  revalidatePath("/rules");
  back(`§${t.section} reset to the template.`, t.id);
}
