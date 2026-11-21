"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";

const OK_MIME = ["application/pdf", "image/png", "image/jpeg", "text/plain", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
export async function uploadDocument(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN", "BOARD");
  const file = fd.get("file");
  const title = String(fd.get("title") || "").trim();
  const category = String(fd.get("category") || "Notices");
  const visibility = fd.get("visibility") === "BOARD" ? "BOARD" : "OWNERS";
  if (!(file instanceof File) || !file.size) redirect("/documents?error=" + encodeURIComponent("Choose a file."));
  if (file.size > 4 * 1024 * 1024) redirect("/documents?error=" + encodeURIComponent("Files must be under 4 MB."));
  if (!OK_MIME.includes(file.type)) redirect("/documents?error=" + encodeURIComponent("Upload a PDF, image, Word, Excel, CSV or text file."));
  const doc = await prisma.document.create({ data: { title: title || file.name, category, visibility, fileName: file.name, mime: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()), uploadedBy: u.name } });
  await audit(u.id, "document uploaded", `${doc.title} (${visibility})`);
  revalidatePath("/documents");
  redirect("/documents?ok=" + encodeURIComponent(`Uploaded "${doc.title}".`));
}
export async function deleteDocument(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const d = await prisma.document.delete({ where: { id: String(fd.get("id")) }, select: { title: true } });
  await audit(u.id, "document deleted", d.title);
  revalidatePath("/documents");
  redirect("/documents?ok=Deleted.");
}
