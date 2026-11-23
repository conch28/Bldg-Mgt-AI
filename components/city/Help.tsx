"use client";
// In-app help for the 3D city map: what each layer and control does, and a short script for demos.
import { useState } from "react";
import { PIPELINE, SOURCES } from "@/lib/clark";

const LAYERS: [string, string, string][] = [
  ["🏙️", "Buildings", "Every real building, coloured by type: offices, homes, malls, factories, hotels, schools. Tap a building or a district name for its details."],
  ["⚡", "Energy now", "Power use per square metre at the hour on the time bar. Blue is low, red is high. Glowing lines show power flowing along the main roads. Use the Without AI / With AI switch to see the difference the AI makes."],
  ["💧", "Water", "Water use per square metre per day. Darker blue drinks more. Blue streams show water moving through the city. The AI switch works here too."],
  ["📊", "Rankings", "Who uses the most electricity or water, and who cut or raised it the most. Pick 1, 3 or 12 months, total or per m², and filter by area or type. Tap a row to fly there."],
  ["☀️", "Solar", "Bright yellow roofs already have panels (sample). Orange roofs show untapped rooftop solar potential."],
  ["🌍", "Carbon", "Tonnes of CO₂ a year from each building's grid power, after its own solar."],
  ["🚨", "Alerts", "What the AI caught today: leaks, lights left on, chillers drifting. Tap an alert to fly there and read the AI's fix."],
];
const CONTROLS: [string, string, string][] = [
  ["🎬", "Present", "A 75-second narrated story for pitches. It goes full screen, flies through the city and ends on the savings. Press → to skip a chapter and Esc to stop."],
  ["🌐", "Google 3D / Satellite / Map", "How the ground looks. Google 3D shows photoreal buildings and terrain. Satellite is a free cloud-free photo. Map is a clean drawn map."],
  ["▶", "Fly-through", "A silent tour of 16 places from New Clark City to Clark, with captions."],
  ["⟲ ＋ －", "Reset and zoom", "Back to the starting view, or zoom in and out. You can also drag to move, right-drag or two fingers to turn, and pinch or Ctrl + scroll to zoom."],
  ["⛶", "Full screen", "Fills the screen. The layer buttons stay at the top of the map."],
  ["🕒", "Time bar", "Plays the day. Watch homes light up at night and offices by day. Drag it to pick an hour."],
  ["₱", "Live savings", "The counter under the map ticks up in real time at the sample daily savings rate."],
];
const DEMO: [string, string][] = [
  ["Before the meeting", "Open the map once so it loads (about 3.5 MB), pick Google 3D, and check your sound is on for the narration. On a TV, open it in Chrome and use full screen."],
  ["0:00 Hook", "Tap 🎬 Present. Let the fly-in play and say nothing; the narration sets the scene."],
  ["0:20 Power and water", "When the glowing flows appear, point at the red pulsing buildings: “these are the ones burning money right now.”"],
  ["0:40 The leak", "The drone zooms in on a leak at 2 AM. Pause here with → off and ask: “How long would it take your team to find this today?”"],
  ["0:55 Before and after", "Watch the city cool down when the AI takes over. Read out the MW and pesos saved."],
  ["1:10 The close", "The 30-day replay and the summary card. Then tap Explore the map and let them tap their own building."],
  ["Questions", "Use Rankings to answer “who are the worst offenders?” and Alerts to show what the AI does about them. Be clear it is sample data on a real map."],
];

export type HelpTab = "layers" | "controls" | "demo" | "data";
const every = (m: number) => (m >= 43200 ? "monthly" : m >= 1440 ? "daily" : `every ${m} min`);

export default function Help({ initial = "layers", onClose, onPresent, onTips }: { initial?: HelpTab; onClose: () => void; onPresent: () => void; onTips: () => void }) {
  const [tab, setTab] = useState<HelpTab>(initial);
  const rows = tab === "layers" ? LAYERS : tab === "controls" ? CONTROLS : null;
  return (
    <div className="cm-help" role="dialog" aria-label="How to use the 3D map">
      <div className="cm-help-h">
        <b>How to use this map</b>
        <button className="cm-btn" onClick={onClose} aria-label="Close help">✕</button>
      </div>
      <div className="cm-help-tabs" role="tablist">
        {([["layers", "Layers"], ["controls", "Buttons"], ["demo", "How to demo it"], ["data", "Where the data comes from"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div className="cm-help-body">
        {rows ? rows.map(([i, t, b]) => <div key={t} className="cm-help-row"><span>{i}</span><div><b>{t}</b><p>{b}</p></div></div>)
          : tab === "demo" ? <ol className="cm-help-demo">{DEMO.map(([t, b]) => <li key={t}><b>{t}</b><p>{b}</p></li>)}</ol>
          : <div className="cm-help-data">
              <p>Today the map shows <b>sample numbers on a real map</b>. Once a building signs up, its own readings replace the samples, through one path:</p>
              <ol className="cm-path cm-path-static">{PIPELINE.map((x) => <li key={x.t} className="on"><span>{x.icon}</span><div><b>{x.t}</b><small>{x.d}</small></div></li>)}</ol>
              <p><b>Start cheap, then upgrade.</b> Week one uses what's already there: guard photos of meters and uploaded bills, read by AI. Then clip-on meters and water pulse readers send readings over LoRaWAN radio every 15 minutes, and urgent alerts reach the owner within 5 minutes.</p>
              <table className="cm-help-t"><thead><tr><th>Source</th><th>How often</th><th>Check</th></tr></thead>
                <tbody>{SOURCES.map((x) => <tr key={x.key}><td>{x.key}</td><td>{every(x.every)}</td><td>{x.check}</td></tr>)}</tbody></table>
              <p><b>Kept honest.</b> The system knows when every meter should report. Late or missing readings become a task with an owner; short gaps are filled from similar days and marked estimated; estimated data never counts toward savings. The Data health panel on the Clark command center shows it all.</p>
            </div>}
      </div>
      <div className="cm-help-f">
        <button className="cm-btn" onClick={onTips}>👆 Show me around</button>
        <button className="cm-btn cm-cta" onClick={onPresent}>🎬 Start the story</button>
      </div>
    </div>
  );
}
