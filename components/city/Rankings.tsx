"use client";
// Building rankings for the 3D city map: biggest electricity and water users, and the
// biggest cuts or rises against an earlier period. All numbers are sample data.
import type { CityScene } from "./cityScene";
import { KIND_LABEL, TARIFF, monthlyHistory, sumRange, monthName, HIST_MONTHS, toLocal, type Kind, type DistrictShape } from "@/lib/nccCity";

export type RankOpts = {
  util: "e" | "w";
  list: "top" | "drop" | "rise";
  months: 1 | 3 | 12;
  vs: "prev" | "yoy";
  basis: "total" | "m2";
  area: string; // "all" | "ncc" | "clark" | district id
  kind: "all" | Kind;
};
export const RANK_DEFAULT: RankOpts = { util: "e", list: "top", months: 1, vs: "prev", basis: "total", area: "all", kind: "all" };
export type RankRow = { i: number; name: string; where: string; value: number; cur: number; prev: number; change: number; floor: number; prog: number };
export type RankResult = { rows: RankRow[]; score: Float32Array; n: number; cur: number; prev: number; lo: number; hi: number; period: string };
type M = { kind: Kind[]; kwh: Float32Array; m3: Float32Array; floor: Float32Array; seed: Int32Array };

const WATER_PRICE = 55; // ₱ per m³, same as the map totals
const SPLIT_Z = toLocal(0, 15.295)[1]; // NCC to the north, Clark to the south
const RANKED: Kind[] = ["apartment", "civic", "sports", "school", "retail", "industrial", "hotel", "transport", "home"];

/** Which buildings get a meter in the demo: big ones, or named ones that aren't tiny. */
export function ranked(sc: CityScene, m: M, i: number) {
  const b = sc.buildings[i];
  if (b.concept || !RANKED.includes(m.kind[i])) return false;
  return m.floor[i] >= 2000 || (b.name != null && m.floor[i] >= 300);
}

export function windows(o: RankOpts) {
  const end = HIST_MONTHS - 1, n = o.months;
  const back = n === 12 || o.vs === "prev" ? n : 12;
  return { a: end - n + 1, b: end, pa: end - n + 1 - back, pb: end - back };
}
export function periodLabel(o: RankOpts) {
  const w = windows(o);
  const span = (a: number, b: number) => (a === b ? monthName(a) : `${monthName(a, false)}–${monthName(b)}`);
  return `${span(w.a, w.b)} vs ${span(w.pa, w.pb)}`;
}

export function computeRanking(sc: CityScene, m: M, districts: DistrictShape[], o: RankOpts): RankResult {
  const B = sc.buildings, N = B.length;
  const score = new Float32Array(N).fill(NaN);
  const e = new Float32Array(HIST_MONTHS), w = new Float32Array(HIST_MONTHS);
  const { a, b, pa, pb } = windows(o);
  const distIdx = o.area !== "all" && o.area !== "ncc" && o.area !== "clark" ? districts.findIndex((d) => d.id === o.area) : -2;
  const rows: RankRow[] = [];
  let totC = 0, totP = 0, lo = Infinity, hi = -Infinity;
  for (let i = 0; i < N; i++) {
    if (!ranked(sc, m, i)) continue;
    const bl = B[i];
    if (o.kind !== "all" && m.kind[i] !== o.kind) continue;
    if (o.area === "ncc" && bl.z > SPLIT_Z) continue;
    if (o.area === "clark" && bl.z <= SPLIT_Z) continue;
    if (distIdx >= -1 && bl.dist !== distIdx) continue;
    const { programmeMonth } = monthlyHistory(m.seed[i], m.kind[i], m.kwh[i], m.m3[i], e, w);
    const v = o.util === "e" ? e : w;
    const cur = sumRange(v, a, b) / o.months, prev = sumRange(v, pa, pb) / o.months;
    totC += cur; totP += prev;
    const per = o.basis === "m2" ? m.floor[i] : 1;
    const change = prev > 0 ? (cur - prev) / prev : 0;
    const value = o.list === "top" ? cur / per : o.basis === "m2" ? change : (cur - prev);
    score[i] = o.list === "top" ? Math.log(1 + cur / per) : change;
    if (o.list === "top") { lo = Math.min(lo, score[i]); hi = Math.max(hi, score[i]); }
    const d = districts[bl.dist];
    rows.push({ i, name: bl.name ?? `${KIND_LABEL[m.kind[i]]}, ${Math.round(m.floor[i]).toLocaleString("en-PH")} m²`, where: d ? d.name : bl.z > SPLIT_Z ? "Clark area" : "New Clark City area", value, cur, prev, change, floor: m.floor[i], prog: programmeMonth });
  }
  rows.sort((x, y) => (o.list === "top" ? y.value - x.value : o.list === "drop" ? x.value - y.value : y.value - x.value));
  const keep = o.list === "drop" ? rows.filter((r) => r.change < 0) : o.list === "rise" ? rows.filter((r) => r.change > 0) : rows;
  return { rows: keep.slice(0, 15), score, n: rows.length, cur: totC, prev: totP, lo, hi, period: periodLabel(o) };
}

const n0 = (v: number) => Math.round(v).toLocaleString("en-PH");
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-PH");
const pct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${n1(Math.abs(v * 100))}%`;
const pesoK = (v: number) => (Math.abs(v) >= 1e6 ? `₱${n1(v / 1e6)}M` : Math.abs(v) >= 1e4 ? `₱${n0(v / 1e3)}k` : `₱${n0(v)}`);
export function fmtUse(util: "e" | "w", v: number, perM2: boolean) {
  if (util === "e") return perM2 ? `${n1(v)} kWh/m²` : v >= 1e6 ? `${n1(v / 1e6)} GWh` : v >= 1e3 ? `${n1(v / 1e3)} MWh` : `${n0(v)} kWh`;
  return perM2 ? `${n0(v * 1000)} L/m²` : `${n0(v)} m³`;
}
const money = (util: "e" | "w", v: number) => v * (util === "e" ? TARIFF : WATER_PRICE);

function Seg<T extends string | number>({ label, value, opts, onChange, disabled }: { label: string; value: T; opts: [T, string][]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="rk-seg" role="radiogroup" aria-label={label}>
      {opts.map(([v, t]) => <button key={String(v)} role="radio" aria-checked={value === v} disabled={disabled} className={"chip" + (value === v ? " on" : "")} onClick={() => onChange(v)}>{t}</button>)}
    </div>
  );
}

export function RankPanel({ o, set, res, districts, onPick }: { o: RankOpts; set: (o: RankOpts) => void; res: RankResult | null; districts: DistrictShape[]; onPick: (i: number) => void }) {
  const u = (p: Partial<RankOpts>) => set({ ...o, ...p });
  const named = districts.filter((d) => !["capas", "angeles", "mabalacat", "cristorey", "camp", "pax"].includes(d.id));
  const tot = res && res.prev > 0 ? (res.cur - res.prev) / res.prev : 0;
  const unit = o.util === "e" ? "electricity" : "water";
  return (
    <div className="rk">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <h3>📊 Building rankings</h3>
        <span className="demo-tag">Sample data</span>
      </div>
      <div className="rk-controls">
        <Seg label="Utility" value={o.util} opts={[["e", "⚡ Electricity"], ["w", "💧 Water"]]} onChange={(util) => u({ util })} />
        <Seg label="List" value={o.list} opts={[["top", "Top users"], ["drop", "Biggest cuts"], ["rise", "Biggest rises"]]} onChange={(list) => u({ list })} />
        <Seg label="Period" value={o.months} opts={[[1, "1 month"], [3, "3 months"], [12, "12 months"]]} onChange={(months) => u({ months })} />
        <Seg label="Compare with" value={o.months === 12 ? "prev" : o.vs} opts={[["prev", "vs previous period"], ["yoy", "vs same time last year"]]} onChange={(vs) => u({ vs })} disabled={o.months === 12} />
        <Seg label="Basis" value={o.basis} opts={[["total", "Total"], ["m2", "Per m² of floor"]]} onChange={(basis) => u({ basis })} />
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <select className="rk-sel" aria-label="Area" value={o.area} onChange={(e) => u({ area: e.target.value })}>
            <option value="all">All areas</option><option value="ncc">New Clark City side</option><option value="clark">Clark Freeport side</option>
            <optgroup label="District">{named.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>
          </select>
          <select className="rk-sel" aria-label="Building type" value={o.kind} onChange={(e) => u({ kind: e.target.value as RankOpts["kind"] })}>
            <option value="all">All building types</option>
            {RANKED.map((k) => <option key={k} value={k}>{k === "home" ? "Large houses" : KIND_LABEL[k]}</option>)}
          </select>
        </div>
      </div>
      {!res ? <p className="hint">Loading buildings…</p> : (
        <>
          <p className="hint rk-sum">
            <b>{res.period}</b> · {n0(res.n)} metered buildings · {unit} {o.months > 1 ? "a month, on average" : "this month"}: <b>{fmtUse(o.util, res.cur, false)}</b> (<span className={tot <= 0 ? "rk-good" : "rk-bad"}>{pct(tot)}</span>)
          </p>
          {res.rows.length === 0 ? <p className="hint">No buildings match. Try another area or type.</p> : (
            <ol className="rk-list">
              {res.rows.map((r, k) => {
                const save = r.cur - r.prev;
                return (
                  <li key={r.i}>
                    <button onClick={() => onPick(r.i)}>
                      <span className="rk-n">{k + 1}</span>
                      <span className="rk-name"><b>{r.name}</b><small>{r.where}{r.prog >= 0 && r.prog <= HIST_MONTHS - 1 ? ` · AI programme since ${monthName(r.prog)}` : ""}</small></span>
                      <span className="rk-val">
                        {o.list === "top" ? <b>{fmtUse(o.util, o.basis === "m2" ? r.cur / r.floor : r.cur, o.basis === "m2")}</b> : <b className={save <= 0 ? "rk-good" : "rk-bad"}>{pct(r.change)}</b>}
                        <small>{o.list === "top" ? `${pct(r.change)} · ${pesoK(money(o.util, r.cur))}/mo` : `${save <= 0 ? "saves" : "adds"} ${fmtUse(o.util, Math.abs(save), false)} · ${pesoK(Math.abs(money(o.util, save)))}/mo`}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="hint">{o.basis === "m2" ? "Per m² compares buildings fairly regardless of size." : o.list === "top" ? "Totals favour big buildings. Switch to per m² to find the least efficient ones." : "Sorted by the size of the change. Switch to per m² to sort by percentage."} Metered here means buildings over 2,000 m² of floor, plus named ones. Monthly figures are averages per month over the period.</p>
        </>
      )}
    </div>
  );
}

/** 12 bars of monthly use for the building card. */
export function MonthBars({ seed, kind, kwhDay, m3Day }: { seed: number; kind: Kind; kwhDay: number; m3Day: number }) {
  const e = new Float32Array(HIST_MONTHS), w = new Float32Array(HIST_MONTHS);
  const { programmeMonth } = monthlyHistory(seed, kind, kwhDay, m3Day, e, w);
  const last = HIST_MONTHS - 1;
  const rows: { k: "e" | "w"; v: Float32Array; label: string; color: string }[] = [{ k: "e", v: e, label: "Electricity", color: "#f4a261" }, { k: "w", v: w, label: "Water", color: "#4292c6" }];
  return (
    <div className="rk-bars">
      {rows.map(({ k, v, label, color }) => {
        const vals = Array.from(v.slice(last - 11)); const max = Math.max(...vals);
        const mom = (v[last] - v[last - 1]) / v[last - 1], yoy = (v[last] - v[last - 12]) / v[last - 12];
        return (
          <div key={k}>
            <div className="row" style={{ justifyContent: "space-between" }}><small><b>{label}</b>, last 12 months</small><small>{fmtUse(k, v[last], false)} in {monthName(last, false)} · <span className={mom <= 0 ? "rk-good" : "rk-bad"}>{pct(mom)}</span> vs last month · <span className={yoy <= 0 ? "rk-good" : "rk-bad"}>{pct(yoy)}</span> vs last year</small></div>
            <div className="rk-chart" role="img" aria-label={`${label} by month`}>
              {vals.map((x, j) => <i key={j} title={`${monthName(last - 11 + j)}: ${fmtUse(k, x, false)}`} style={{ height: `${(x / max) * 100}%`, background: color, opacity: j === 11 ? 1 : 0.55 }} />)}
            </div>
          </div>
        );
      })}
      {programmeMonth >= 0 && <p className="hint">🤖 AI efficiency programme started {monthName(programmeMonth)} (sample).</p>}
    </div>
  );
}
