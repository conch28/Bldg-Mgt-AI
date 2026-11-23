import { requireRole } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import GreenDashboard from "@/components/green/GreenDashboard";
import { SITES, siteForEmail, briefingFacts, type SiteKey } from "@/lib/green";
import { writeDoc } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sustainability" };

const SYSTEM = "You are the AI sustainability assistant of a property manager in the Philippines. Write today's spoken green briefing for the site's operations head: under 110 words, warm and brisk. Lead with the one thing that needs action, then the savings, then how people feel. Natural English with a light touch of Taglish ('po' once at most). No markdown, bullets or emojis. Say money as pesos. Use only the facts given; never invent names, numbers or events.";

export default async function Green({ searchParams }: { searchParams: { site?: string } }) {
  const u = await requireRole("CLIENT", "BOARD", "MANAGER", "ADMIN");
  // Client demo logins always see their own site; our own team can switch between the demos.
  const own = u.role === "CLIENT" ? siteForEmail(u.email) ?? "ncc" : null;
  const key: SiteKey = own ?? (searchParams.site === "pax" ? "pax" : "ncc");
  const site = SITES[key];
  const { facts, fallback } = briefingFacts(site);
  const b = await Promise.race([
    writeDoc(SYSTEM, facts, fallback),
    new Promise<{ text: string; ai: boolean }>((r) => setTimeout(() => r({ text: fallback, ai: false }), 9000)),
  ]);
  return (
    <>
      <PageHead title="Sustainability" sub={`Power, water and carbon at ${site.name}, run by AI. Sample data for this demo.`} right={<span className="demo-tag">DEMO · sample data</span>} />
      <GreenDashboard siteKey={key} briefing={b.text} aiWritten={b.ai} canSwitch={!own} />
    </>
  );
}
