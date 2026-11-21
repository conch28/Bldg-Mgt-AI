import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import Chat from "@/components/Chat";
import { aiEnabled } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const u = await requireRole("OWNER");
  const hist = await prisma.chatMessage.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <>
      <PageHead title="Helpdesk chat" sub="24/7 in English, Tagalog or Taglish. Repairs you report here become tickets automatically." />
      <main className="view">
        <div className="chatlayout">
          <Chat initial={hist.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))} name={u.name.split(" ")[0]} ai={aiEnabled()} />
          <div className="card"><span className="ai-badge">What I can do</span>
            <div className="list" style={{ marginTop: 6 }}>
              <div className="li"><b style={{ width: 120, flex: "none" }}>Answers</b><div>Balances, house rules, permits and amenity hours.</div></div>
              <div className="li"><b style={{ width: 120, flex: "none" }}>Repairs</b><div>Describe the problem and I&apos;ll open a ticket with a deadline.</div></div>
              <div className="li"><b style={{ width: 120, flex: "none" }}>Bookings</b><div>Aircon cleaning, deep cleaning, pest control and more.</div></div>
              <div className="li"><b style={{ width: 120, flex: "none" }}>A person</b><div>Complaints and disputes go to the property manager within 15 minutes.</div></div>
            </div>
            <div className="hint" style={{ marginTop: 10 }}>Emergency? Call the guard house at local 100, or 911.</div>
          </div>
        </div>
      </main>
    </>
  );
}
