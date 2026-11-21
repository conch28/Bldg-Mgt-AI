"use server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { demoMode } from "@/lib/env";
import { channelReply } from "@/lib/channels";
import { rateLimit } from "@/lib/ratelimit";

/** Demo only: send a message "from" the sample owner's Messenger or Viber and get the assistant's reply. */
export async function simulate(ch: "MESSENGER" | "VIBER", text: string): Promise<{ reply: string; ai: boolean } | { error: string }> {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  if (!demoMode()) return { error: "The simulator only runs on the demo site, so it never acts on a real owner's account." };
  const p = z.object({ ch: z.enum(["MESSENGER", "VIBER"]), text: z.string().trim().min(1).max(500) }).safeParse({ ch, text });
  if (!p.success) return { error: "Type a message first." };
  if (!(await rateLimit(`sim:${u.id}`, 15, 60)).ok) return { error: "Please wait a minute." };
  const owner = await prisma.user.findUnique({ where: { email: "owner@skyland.test" } });
  if (!owner) return { error: "The sample owner isn't in this database." };
  return channelReply(owner, p.data.ch, p.data.text);
}
