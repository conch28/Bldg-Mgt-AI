import { requireRole } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import BcdaBuilding from "@/components/bcda/BcdaBuilding";
import { briefingFacts, BCDA_NAME } from "@/lib/bcda";
import { writeDoc } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const metadata = { title: "BCDA building" };

const SYSTEM = "You are the AI building manager of a government office building owned by BCDA (Bases Conversion and Development Authority) in New Clark City, Philippines. Write today's spoken briefing for BCDA's asset manager: under 110 words, warm and brisk. Lead with the one thing that needs action today, then uptime and energy, then leases and compliance. Natural English with a light touch of Taglish ('po' once at most). No markdown, bullets or emojis. Say money as pesos. Use only the facts given; never invent names, numbers, agencies or events.";

export default async function BcdaPage({ searchParams }: { searchParams: { from?: string } }) {
  await requireRole("CLIENT", "BOARD", "MANAGER", "ADMIN");
  const { facts, fallback } = briefingFacts();
  const b = await Promise.race([
    writeDoc(SYSTEM, facts, fallback),
    new Promise<{ text: string; ai: boolean }>((r) => setTimeout(() => r({ text: fallback, ai: false }), 9000)),
  ]);
  return (
    <>
      <PageHead title="BCDA building" sub={`${BCDA_NAME}, New Clark City. Sample data for this demo.`} back="/green/map?focus=ncc-gov" right={<span className="demo-tag">DEMO · sample data</span>} />
      <BcdaBuilding briefing={b.text} aiWritten={b.ai} fromMap={searchParams.from === "map"} />
    </>
  );
}
