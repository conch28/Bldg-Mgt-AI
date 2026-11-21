import { PREP, RESIDENT_TIP, dayWord, wxIcon, wxWord, type Weather } from "@/lib/weather";
import { draftStormAdvisory, openPrepTicket } from "@/app/(app)/advisor/actions";
import SubmitButton from "@/components/SubmitButton";

const RISK_CLS = { storm: "wx-storm", rain: "wx-rain", heat: "wx-heat", ok: "" } as const;
const dow = (date: string) => new Date(date + "T12:00:00+08:00").toLocaleDateString("en-PH", { weekday: "short", timeZone: "Asia/Manila" });

/** One-line banner for pages where weather is secondary. */
export function WeatherStrip({ w, href = "/advisor#weather" }: { w: Weather; href?: string }) {
  return <a href={href} className={"wx-strip " + RISK_CLS[w.risk]}><span className="wx-ico" aria-hidden="true">{w.riskDay ? wxIcon(w.riskDay.code) : "⛅"}</span><span>{w.headline}</span></a>;
}

/** 5-day Makati forecast with the prep list when heavy rain, a typhoon or extreme heat is coming. */
export function WeatherCard({ w, staff, resident, compact, drillHref }: { w: Weather; staff?: boolean; resident?: boolean; compact?: boolean; drillHref?: string }) {
  const tip = RESIDENT_TIP[w.risk];
  const prep = w.risk === "ok" ? null : PREP[w.risk];
  return (
    <div className={"card wx " + RISK_CLS[w.risk]} id="weather">
      <div className="wx-top">
        <div>
          <span className="ai-badge">{w.live ? "Live" : w.source.startsWith("Typhoon drill") ? "Drill" : "Typical"}</span>
          <h3 style={{ marginTop: 4 }}>Makati weather</h3>
        </div>
        {w.now && <div className="wx-now"><span className="wx-big" aria-hidden="true">{wxIcon(w.now.code)}</span><div><b className="num">{Math.round(w.now.temp)}°C</b><div className="hint">{wxWord(w.now.code)} · feels {Math.round(w.now.feels)}°</div></div></div>}
      </div>
      <div className="wx-days" role="list">
        {w.days.slice(0, compact ? 3 : 5).map((d) => (
          <div className={"wx-day" + (w.riskDay?.date === d.date ? " on" : "")} key={d.date} role="listitem" aria-label={`${dayWord(d.date)}: ${wxWord(d.code)}, ${Math.round(d.max)} degrees, ${Math.round(d.rain)} millimetres of rain`}>
            <span className="hint">{dayWord(d.date) === "today" ? "Today" : dow(d.date)}</span>
            <span className="wx-i" aria-hidden="true">{wxIcon(d.code)}</span>
            <b className="num">{Math.round(d.max)}°</b><span className="hint num">{Math.round(d.min)}°</span>
            <span className="wx-rain num" title="Rain">{d.rain >= 1 ? `${Math.round(d.rain)} mm` : "dry"}</span>
            {d.gust >= 40 && <span className="wx-gust num" title="Wind gusts">{Math.round(d.gust)} km/h</span>}
          </div>
        ))}
      </div>
      {(w.live || w.risk !== "ok") && <div className={"wx-head" + (w.risk === "ok" ? " calm" : "")}>{w.headline}</div>}
      {resident && tip && <div className="wx-tip"><b>What you can do:</b> {tip.en}<div className="hint" lang="tl">{tip.tl}</div></div>}
      {staff && prep && !compact && (
        <div className="wx-prep">
          <b>{w.risk === "storm" ? "Typhoon prep list" : w.risk === "rain" ? "Heavy-rain prep" : "Heat prep"}</b>
          <ol>{prep.map((p) => <li key={p.task}><span className="tag t-mut">{p.who}</span> {p.task}</li>)}</ol>
          <div className="row" style={{ marginTop: 8 }}>
            <form action={openPrepTicket}><input type="hidden" name="risk" value={w.risk} /><SubmitButton label="Assign as a work order" busy="Opening…" cls="btn pri" small /></form>
            {w.risk !== "heat" && <form action={draftStormAdvisory}><input type="hidden" name="risk" value={w.risk} /><input type="hidden" name="day" value={w.riskDay?.date ?? ""} /><SubmitButton label="Draft resident advisory" busy="Drafting…" cls="btn" small /></form>}
          </div>
        </div>
      )}
      {staff && prep && compact && <a className="btn sm pri" href="/advisor#weather" style={{ marginTop: 8 }}>Open the prep list</a>}
      <div className="hint wx-src">{w.source}{drillHref && w.risk === "ok" ? <> · <a href={drillHref}>Preview the typhoon drill</a></> : null}</div>
    </div>
  );
}
