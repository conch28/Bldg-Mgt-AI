import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import ChannelDemo from "@/components/ChannelDemo";
import { channelSetup } from "@/lib/channels";
import { demoMode } from "@/lib/env";
import { aiEnabled } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default async function Channels() {
  await requireRole("BOARD", "MANAGER", "ADMIN");
  const since = new Date(Date.now() - 30 * 86400000);
  const [linkedM, linkedV, byCh] = await Promise.all([
    prisma.user.count({ where: { messengerPsid: { not: null }, active: true } }),
    prisma.user.count({ where: { viberId: { not: null }, active: true } }),
    prisma.chatMessage.groupBy({ by: ["channel"], where: { role: "user", createdAt: { gte: since } }, _count: true }),
  ]);
  const n = (c: string) => byCh.find((x) => x.channel === c)?._count ?? 0;
  const setup = channelSetup();
  return (
    <>
      <PageHead title="Messenger & Viber assistant" sub="Residents chat where they already are. Same assistant as the app's Help tab, with the same tools: balances, repair tickets, service bookings and hand-off to the manager. English, Tagalog or Taglish." />
      <main className="view">
        <div className="grid g4">
          <Kpi k="Owners on Messenger" v={linkedM} /><Kpi k="Owners on Viber" v={linkedV} />
          <Kpi k="Messages, 30 days" v={n("APP") + n("MESSENGER") + n("VIBER")} d={`App ${n("APP")} · Messenger ${n("MESSENGER")} · Viber ${n("VIBER")}`} />
          <Kpi k="Assistant" v={aiEnabled() ? "Claude" : "Scripted"} d={aiEnabled() ? "Full AI replies" : "Add the Anthropic key for full AI"} />
        </div>
        <div className="grid g-7-5">
          <div className="card"><h3>Try it {demoMode() ? "(as sample owner Ana Reyes, 1202B)" : ""}</h3>
            <p className="hint" style={{ marginTop: 0 }}>Messages here run through the real assistant: a leak report files a real ticket, and a balance question reads the real ledger.</p>
            <ChannelDemo enabled={demoMode()} />
          </div>
          <div className="card"><h3>Connection</h3>
            <div className="list" style={{ marginTop: 6 }}>
              <div className="li"><span className={"tag " + (setup.MESSENGER ? "t-ok" : "t-mut")}>{setup.MESSENGER ? "Live" : "Not connected"}</span><div style={{ flex: 1 }}><b>Facebook Messenger</b><div className="hint">Webhook <span className="mono">/api/messenger</span> · needs MESSENGER_PAGE_TOKEN, MESSENGER_APP_SECRET, MESSENGER_VERIFY_TOKEN, MESSENGER_PAGE</div></div></div>
              <div className="li"><span className={"tag " + (setup.VIBER ? "t-ok" : "t-mut")}>{setup.VIBER ? "Live" : "Not connected"}</span><div style={{ flex: 1 }}><b>Viber</b><div className="hint">Webhook <span className="mono">/api/viber</span> · needs VIBER_TOKEN, VIBER_URI</div></div></div>
            </div>
            <h4 style={{ marginTop: 14 }}>How owners link</h4>
            <ol className="hint" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Owner taps <b>Link Messenger</b> or <b>Link Viber</b> in My account.</li>
              <li>The chat opens with a signed code, so we know which unit they are. No code, no account details.</li>
              <li>From then on, building notices can go to their chat too.</li>
            </ol>
          </div>
        </div>
      </main>
    </>
  );
}
