"use client";
import { useEffect, useState } from "react";
type Mode = "light" | "system" | "dark";
export default function ThemeSwitch() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => { try { setMode((localStorage.getItem("theme") as Mode) || "system"); } catch {} }, []);
  function pick(m: Mode) {
    setMode(m);
    try { localStorage.setItem("theme", m); } catch {}
    if (m === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = m;
  }
  return (
    <div className="theme-switch" role="group" aria-label="Colour theme">
      {(["light", "system", "dark"] as Mode[]).map((m) => <button key={m} type="button" className={mode === m ? "on" : ""} aria-pressed={mode === m} onClick={() => pick(m)}>{m === "light" ? "☀ Light" : m === "dark" ? "☾ Dark" : "Auto"}</button>)}
    </div>
  );
}
