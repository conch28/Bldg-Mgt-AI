"use client";
import { useEffect, useState } from "react";
export default function SlaTimer({ deadline }: { deadline: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (now == null) return <span className="sla">…</span>;
  const ms = deadline - now, a = Math.abs(ms);
  const h = Math.floor(a / 3600000), m = Math.floor((a % 3600000) / 60000), s = Math.floor((a % 60000) / 1000);
  const t = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return <span className={"sla " + (ms < 0 ? "down" : ms < 3600000 ? "amber" : "")}>{ms < 0 ? `Over by ${t}` : `${t} left`}</span>;
}
