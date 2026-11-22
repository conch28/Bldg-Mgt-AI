import Link from "next/link";
import { requireRole, PEOPLE } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { WeatherCard } from "@/components/Weather";
import { getWeather, RESIDENT_TIP } from "@/lib/weather";
import { floodRisk, activeStorm } from "@/lib/typhoon";
import { TOWERS, residentialFloors, STACKS, PH_STACKS, SITE } from "@/lib/skyland";
import { fmtDateTime } from "@/lib/format";
import { demoMode } from "@/lib/env";
import { startTyphoon, startCheckins, endTyphoon, checkIn } from "./actions";

export const dynamic = "force-dynamic";
const RISK_CLS = { high: "t-bad", medium: "t-warn", low: "t-ok" } as const;
const CI: Record<string, { label: string; color: string }> = { OK: { label: "Safe", color: "#009E73" }, DAMAGE: { label: "Damage", color: "#E69F00" }, HELP: { label: "Needs help", color: "#D55E00" } };

export default async function Typhoon({ searchParams }: { searchParams: { ok?: string; error?: string; drill?: string } }) {
  const u = await requireRole(...PEOPLE);
  const owner = u.role === "OWNER", mgr = u.role === "MANAGER" || u.role === "ADMIN";
  const storm = await activeStorm();
  // On the demo site, a storm that was started from the drill keeps showing the drill forecast.
  const w = await getWeather({ drill: searchParams.drill === "1" || (!!storm && demoMode()) });
  const tip = RESIDENT_TIP.storm!;

  if (owner) {
    const units = await prisma.unit.findMany({ where: { ownerId: u.id }, select: { id: true } });
    const mine = storm ? await prisma.stormCheckin.findFirst({ where: { stormId: storm.id, unitId: { in: units.map((x) => x.id) } } }) : null;
    return (
      <>
        <PageHead title="Typhoon & safety" sub={storm ? `${storm.name}: ${storm.phase === "CHECKIN" ? "the storm has passed. Please check in." : "typhoon mode is on. Please prepare."}` : "No storm alert right now. Here's how we keep Skyland safe when one comes."} />
        <main className="view">
          {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
          {storm?.phase === "CHECKIN" && (
            <div className="card storm-ci">
              <h3>Are you OK po?</h3>
              {mine && <div className="hint" style={{ marginBottom: 8 }}>You checked in as <b>{CI[mine.status].label}</b>. You can update it.</div>}
              <form action={checkIn} className="stack">
                <div className="field"><label htmlFor="note">Anything we should know? (optional)</label><input id="note" name="note" placeholder="Water came in by the balcony door / Lola needs her meds" /></div>
                <div className="ci-btns">
                  <button name="status" value="OK" className="ci ok">✅<b>Safe</b><span>No damage</span></button>
                  <button name="status" value="DAMAGE" className="ci dmg">🏚️<b>Damage</b><span>Water, glass, ceiling</span></button>
                  <button name="status" value="HELP" className="ci help">🆘<b>I need help</b><span>Someone comes up</span></button>
                </div>
              </form>
            </div>
          )}
          <div className="card"><h3>{storm ? "What to do now" : "When a typhoon comes"}</h3>
            <p style={{ marginTop: 4 }}>{tip.en}</p><p className="hint">{tip.tl}</p>
            <ul className="hint" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
              <li>Charge phones and power banks; keep a flashlight, water and 3 days of medicine handy.</li>
              <li>If you park in B2, move your car to B1 when typhoon mode is on.</li>
              <li>Lifts may stop if power fails. The generator keeps one lift per tower, the water pumps and the hallway lights running.</li>
              <li>Emergency: guard house local 100, or the SOS button in the app.</li>
            </ul>
          </div>
          <WeatherCard w={w} resident compact />
        </main>
      </>
    );
  }

  const zones = floodRisk(w);
  const [checkins, total] = storm ? await Promise.all([prisma.stormCheckin.findMany({ where: { stormId: storm.id } }), prisma.unit.count()]) : [[], 0];
  const by = new Map(checkins.map((c) => [c.unitCode, c]));
  const n = (s: string) => checkins.filter((c) => c.status === s).length;
  const urgent = checkins.filter((c) => c.status !== "OK").sort((a, b) => (a.status === "HELP" ? 0 : 1) - (b.status === "HELP" ? 0 : 1));
  return (
    <>
      <PageHead title="Typhoon mode" sub="One tap to alert every resident and start the prep list; a flood-risk view of the building; and a check-in from every unit after the storm." />
      <main className="view">
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        <div className={"card storm-bar" + (storm ? " on" : "")}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className={"tag " + (storm ? "t-bad" : "t-mut")}>{storm ? (storm.phase === "CHECKIN" ? "After the storm: check-ins" : "Typhoon mode ON") : "Normal"}</span>
            <h3 style={{ marginTop: 6 }}>{storm ? storm.name : w.risk === "storm" ? "A storm is forecast" : "No storm forecast"}</h3>
            <div className="hint">{storm ? `Started ${fmtDateTime(storm.startedAt)} by ${storm.createdBy}` : w.headline}</div>
          </div>
          {mgr && (!storm ? (
            <form action={startTyphoon} className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <input name="name" placeholder="Storm name, e.g. Typhoon Pepito" aria-label="Storm name" style={{ minWidth: 220 }} />
              <SubmitButton label="Turn on typhoon mode" busy="Alerting residents…" />
            </form>
          ) : storm.phase === "PREP" ? (
            <form action={startCheckins}><SubmitButton label="Storm passed: ask units to check in" busy="Sending…" /></form>
          ) : (
            <form action={endTyphoon}><SubmitButton label="All clear: end typhoon mode" busy="…" cls="btn" /></form>
          ))}
        </div>
        {!storm && mgr && <div className="hint">Turning it on sends an urgent alert to every owner (app, SMS and Messenger), assigns the prep checklist to Engineering, and shows a storm banner on every resident&apos;s home screen. {w.risk !== "storm" && <Link href="/typhoon?drill=1">See it with a sample storm forecast</Link>}</div>}

        {storm?.phase === "CHECKIN" && (
          <div className="grid g-7-5">
            <div className="card"><h3>Check-ins: {checkins.length} of {total} units</h3>
              <div className="row hint" style={{ gap: 14, flexWrap: "wrap", margin: "4px 0 8px" }}>{Object.entries(CI).map(([k, v]) => <span key={k}><i className="dotp" style={{ background: v.color }} /> {v.label} {n(k)}</span>)}<span><i className="dotp" style={{ background: "var(--line)" }} /> No reply {total - checkins.length}</span></div>
              <div className="ci-towers">{TOWERS.map((t) => (
                <div key={t.id}><b className="hint">{t.label}</b>
                  <div className="ci-grid">{[SITE.penthouseFloor, ...residentialFloors().reverse()].map((f) => (
                    <div className="ci-row" key={f}><span className="ci-fl">{f === SITE.penthouseFloor ? "PH" : f}</span>{(f === SITE.penthouseFloor ? PH_STACKS : STACKS).map((s) => {
                      const code = `${f}${s}${t.id}`, c = by.get(code);
                      return <span key={code} className={"ci-cell" + (f === SITE.penthouseFloor ? " ph" : "")} title={`${code}: ${c ? CI[c.status].label : "no reply"}`} style={{ background: c ? CI[c.status].color : undefined }} />;
                    })}</div>))}</div>
                </div>))}</div>
            </div>
            <div className="card"><h3>Reach these first</h3>
              <div className="list" style={{ marginTop: 6 }}>{urgent.length ? urgent.map((c) => <div className="li" key={c.id}><span className="tag" style={{ background: CI[c.status].color, color: "#fff" }}>{CI[c.status].label}</span><div style={{ flex: 1 }}><b>Unit {c.unitCode}</b><div className="hint">{c.note ?? "No note"} · {fmtDateTime(c.createdAt)}</div></div></div>) : <div className="empty">No one has asked for help.</div>}</div>
              <div className="hint" style={{ marginTop: 8 }}>Every Damage or Help reply already opened a high-priority ticket. <Link href="/work-orders">Open work orders</Link></div>
            </div>
          </div>
        )}

        <div className="card"><h3>Flood and wind risk for {w.riskDay ? "the worst day in the forecast" : "the next 3 days"}</h3>
          <div className="list" style={{ marginTop: 6 }}>{zones.map((z) => (
            <div className="li" key={z.id} style={{ alignItems: "flex-start" }}><span className={"tag " + RISK_CLS[z.risk]}>{z.risk === "high" ? "High" : z.risk === "medium" ? "Medium" : "Low"}</span>
              <div style={{ flex: 1, minWidth: 0 }}><b>{z.name}</b><div className="hint">{z.why}</div>{z.risk !== "low" && <div style={{ fontSize: 13, marginTop: 2 }}>→ {z.todo}</div>}</div></div>))}</div>
        </div>
        <WeatherCard w={w} staff={mgr} drillHref="/typhoon?drill=1" />
      </main>
    </>
  );
}
