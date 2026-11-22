import { prisma } from "./db";

const OK_MIME = ["application/pdf", "image/png", "image/jpeg", "text/plain", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
/** Stores an uploaded supporting file in Documents (board-only by default). Returns the id, or an error message. */
export async function saveUpload(file: FormDataEntryValue | null, title: string, category: string, uploadedBy: string, visibility: "BOARD" | "OWNERS" = "BOARD"): Promise<{ id?: string; error?: string }> {
  if (!(file instanceof File) || !file.size) return {};
  if (file.size > 4 * 1024 * 1024) return { error: "Files must be under 4 MB." };
  if (!OK_MIME.includes(file.type)) return { error: "Upload a PDF, photo, Word, Excel, CSV or text file." };
  const d = await prisma.document.create({ data: { title, category, visibility, fileName: file.name, mime: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()), uploadedBy } });
  return { id: d.id };
}
