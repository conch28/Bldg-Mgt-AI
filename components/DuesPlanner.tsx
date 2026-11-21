"use client";
import { useState } from "react";

const COSTS: [string, number][] = [
  ["Minimum wage adjustment, security & janitorial (+6%)", 41400],
  ["Meralco rate trend, common areas (+8%)", 23300],
  ["Elevator modernisation reserve (2029 project)", 35000],
  ["Close the current operating gap", 18300],
];
const SAVINGS: [string, number, boolean][] = [
  ["Clean chiller 2 condenser and tune schedule", 26000, true],
  ["LED retrofit, parking levels P1–P3", 22000, true],
  ["Re-bid janitorial contract (3 quotes)", 18000, false],
  ["Rooftop solar with net metering", 35000, false],
];
const peso = (n: number) => "₱" + Math.round(n).toLocaleString("en-PH");

export default function DuesPlanner({ billed, units, rate, typicalSqm }: { billed: number; units: number; rate: number; typicalSqm: number }) {
  const [on, setOn] = useState(SAVINGS.map((s) => s[2]));
  const gap = COSTS.reduce((s, c) => s + c[1], 0);
  const save = SAVINGS.reduce((s, x, i) => s + (on[i] ? x[1] : 0), 0);
  const need = Math.max(0, gap - save);
  const pct = (need / billed) * 100;
  return (
    <div>
      <table style={{ marginBottom: 10 }}><tbody>
        {COSTS.map(([l, v]) => <tr key={l}><td>{l}</td><td className="r num">+{peso(v)}</td></tr>)}
        <tr style={{ fontWeight: 700 }}><td>Monthly shortfall before savings</td><td className="r num">{peso(gap)}</td></tr>
      </tbody></table>
      <div className="hint" style={{ marginBottom: 4 }}>Savings the board can approve</div>
      {SAVINGS.map(([l, v], i) => (
        <label className="toggle" key={l}><input type="checkbox" id={`sv${i}`} checked={on[i]} onChange={(e) => setOn(on.map((x, j) => (j === i ? e.target.checked : x)))} /><span style={{ flex: 1 }}>{l}</span><span className="num up">−{peso(v)}</span></label>
      ))}
      <div className="aibox" style={{ marginTop: 12 }}>
        <b>Increase needed: {pct.toFixed(1)}%</b>, from ₱{rate.toFixed(2)} to ₱{(rate * (1 + pct / 100)).toFixed(2)} per sqm. For a {typicalSqm} sqm unit that is <b>+{peso((need / billed) * rate * typicalSqm)} a month</b>. Average across {units} units: +{peso(need / units)}.
      </div>
      <div className="hint" style={{ marginTop: 8 }}>Cost assumptions are illustrative; replace them with the 2027 budget figures.</div>
    </div>
  );
}
