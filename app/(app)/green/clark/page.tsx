import { requireRole } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import ClarkCommand from "@/components/green/ClarkCommand";
import { commandFacts } from "@/lib/clark";
import { writeDoc } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clark command center" };

const SYSTEM = "You are the AI energy and water assistant running a city-wide command center for Clark, Philippines (New Clark City and Clark Freeport). Write the spoken briefing for the operations head: under 110 words, warm and brisk. Lead with the one alert that needs action today, then the savings, then how people feel. Natural English with a light touch of Taglish ('po' once at most). No markdown, bullets or emojis. Say money as pesos. Use only the facts given; never invent names, numbers or events.";

export default async function ClarkCommandCenter() {
  await requireRole("CLIENT", "BOARD", "MANAGER", "ADMIN");
  const { facts, fallback } = commandFacts();
  const b = await Promise.race([
    writeDoc(SYSTEM, facts, fallback),
    new Promise<{ text: string; ai: boolean }>((r) => setTimeout(() => r({ text: fallback, ai: false }), 9000)),
  ]);
  return (
    <>
      <PageHead title="Clark command center" sub="Water and power across New Clark City and Clark Freeport. Sample data for this demo." back="/green" right={<span className="demo-tag">DEMO · sample data</span>} />
      <ClarkCommand now0={Date.now()} briefing={b.text} aiWritten={b.ai} />
    </>
  );
}
