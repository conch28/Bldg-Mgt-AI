import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import SnapReport from "./SnapReport";

export const dynamic = "force-dynamic";

export default async function Report() {
  const u = await requireRole("OWNER");
  const units = await prisma.unit.findMany({ where: { ownerId: u.id }, orderBy: { code: "asc" }, select: { code: true } });
  return (
    <>
      <PageHead title="Report a problem" sub="Snap a photo. AI files the ticket for you." back="/home" />
      <main className="view" style={{ maxWidth: 640 }}>
        <SnapReport units={units.map((x) => x.code)} ai={aiEnabled()} />
        <div className="hint" style={{ textAlign: "center" }}>Prefer to type? <Link href="/chat" style={{ color: "var(--accent)" }}>Chat with the helpdesk</Link> · Emergency? <Link href="/sos" style={{ color: "var(--bad)" }}>Press SOS</Link></div>
      </main>
    </>
  );
}
