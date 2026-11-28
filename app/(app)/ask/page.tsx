import { requireRole } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import AskAI from "@/components/AskAI";
import { aiEnabled } from "@/lib/ai";
import { CARDS, GROUPS, KB_REVIEWED } from "@/lib/askkb";
import { fmtDate } from "@/lib/format";
import Link from "next/link";
import { loadLibrary, loadRules } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export default async function AskPage() {
  const u = await requireRole("OWNER", "BOARD", "MANAGER", "ADMIN");
  const audience = u.role === "OWNER" ? "owner" : "board";
  const [rules, lib] = await Promise.all([loadRules().then((r) => r.length), loadLibrary().then((l) => l.length)]);
  return (
    <>
      <PageHead title="Ask AI" sub={audience === "owner" ? "Your rights, dues, repairs, neighbours, pets and renting, explained simply with the law behind each answer." : "Condo law, AGM and board procedure, collections and privacy, with sources. Ask before you act."} />
      <main className="view">
        <div className="chatlayout">
          <AskAI audience={audience} name={u.name.split(" ")[0]} ai={aiEnabled()} canAct={u.role === "OWNER"} />
          <div className="card"><span className="ai-badge">What Ask AI knows</span>
            <div className="list" style={{ marginTop: 6 }}>
              {GROUPS.map((g) => <div className="li" key={g}><b style={{ width: 150, flex: "none" }}>{g}</b><div>{CARDS.filter((c) => c.group === g).length} topics</div></div>)}
              <div className="li"><b style={{ width: 150, flex: "none" }}>House rules</b><div>{rules} rules · <Link href="/rules">read them</Link></div></div>
              <div className="li"><b style={{ width: 150, flex: "none" }}>Legal library</b><div>{lib} laws, rulings and tax and privacy issuances · <Link href="/ask/library">search</Link></div></div>
              {audience === "owner" && <div className="li"><b style={{ width: 150, flex: "none" }}>Can do for you</b><div>Repairs, guest, parking and delivery passes, amenity bookings. You confirm each one.</div></div>}
            </div>
            <div className="hint" style={{ marginTop: 10 }}>Grounded in the Condominium Act (RA 4726), the Revised Corporation Code (RA 11232), the Civil Code, the Data Privacy Act, Supreme Court rulings, BIR and NPC issuances, and the house rules (a best-practice template until the board approves Skyland&apos;s own). Sources reviewed {fmtDate(new Date(KB_REVIEWED))}.</div>
            <div className="hint" style={{ marginTop: 6 }}>Your questions stay in this browser tab and aren&apos;t saved. Only what you send with &quot;Talk to a person&quot; goes to the property manager.</div>
            <div className="hint" style={{ marginTop: 6 }}>General information, not legal advice. Emergency? Call the guard house at local 100, or 911.</div>
          </div>
        </div>
      </main>
    </>
  );
}
