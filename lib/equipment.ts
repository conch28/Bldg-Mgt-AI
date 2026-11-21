/**
 * Elevator and generator health from IoT sensors, with a simple breakdown forecast:
 * a straight-line trend over the last 14 days, projected to the alarm limit.
 * Limits follow common practice (ISO 10816 vibration bands; 12 V lead-acid battery rest voltage).
 */
import { prisma } from "./db";

type Limit = { label: string; unit: string; warn: number; alarm: number; down?: boolean };
export const LIMITS: Record<string, Limit> = {
  VIBRATION: { label: "Motor vibration", unit: "mm/s", warn: 4.5, alarm: 7.1 },
  DOOR_FAULTS: { label: "Door re-opens", unit: "/day", warn: 4, alarm: 8 },
  TRIPS: { label: "Trips", unit: "/day", warn: 1e9, alarm: 1e9 },
  BATTERY_V: { label: "Starter battery", unit: "V", warn: 12.2, alarm: 11.9, down: true },
  COOLANT_C: { label: "Coolant at test", unit: "°C", warn: 95, alarm: 105 },
  PRESSURE_BAR: { label: "Discharge pressure", unit: "bar", warn: 4.2, alarm: 3.6, down: true },
};
export type MetricHealth = { metric: string; label: string; unit: string; last: number; series: number[]; state: "ok" | "warn" | "alarm"; daysToAlarm: number | null };
export type AssetHealth = { id: string; tag: string; name: string; category: string; location: string; score: number; state: "ok" | "warn" | "alarm"; metrics: MetricHealth[]; forecast: string; openWo: number | null };

const slope = (ys: number[]) => {
  const n = ys.length; if (n < 3) return 0;
  const mx = (n - 1) / 2, my = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0, den = 0; ys.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) ** 2; });
  return den ? num / den : 0;
};

export const SENSOR_TAGS = /^(EV-[AB]\d|EL-GEN|PM-)/;

export async function equipmentHealth(): Promise<AssetHealth[]> {
  const since = new Date(Date.now() - 14 * 86400000);
  const assets = await prisma.asset.findMany({ where: { sensors: { some: {} } }, include: { sensors: { where: { at: { gte: since } }, orderBy: { at: "asc" } } }, orderBy: { tag: "asc" } });
  const wos = await prisma.workOrder.findMany({ where: { status: { not: "DONE" }, source: "Equipment AI" }, select: { number: true, location: true } });
  return assets.map((a) => {
    const metrics: MetricHealth[] = [];
    for (const [metric, L] of Object.entries(LIMITS)) {
      const rows = a.sensors.filter((s) => s.metric === metric);
      if (!rows.length) continue;
      // daily mean
      const days = new Map<string, number[]>();
      for (const r of rows) { const k = r.at.toISOString().slice(0, 10); days.set(k, [...(days.get(k) ?? []), r.value]); }
      const series = [...days.values()].map((v) => v.reduce((s, x) => s + x, 0) / v.length);
      const last = series[series.length - 1];
      const bad = (v: number, lim: number) => (L.down ? v <= lim : v >= lim);
      const state: MetricHealth["state"] = bad(last, L.alarm) ? "alarm" : bad(last, L.warn) ? "warn" : "ok";
      const m = slope(series.slice(-10));
      let daysToAlarm: number | null = null;
      if (state !== "alarm" && L.alarm < 1e8 && ((L.down && m < -1e-6) || (!L.down && m > 1e-6))) {
        const d = (L.alarm - last) / m;
        if (d > 0 && d < 120) daysToAlarm = Math.round(d);
      }
      const dp = metric === "BATTERY_V" ? 100 : metric === "TRIPS" ? 1 : 10;
      metrics.push({ metric, label: L.label, unit: L.unit, last: Math.round(last * dp) / dp, series, state, daysToAlarm });
    }
    const soon = metrics.filter((m) => m.daysToAlarm != null).sort((x, y) => x.daysToAlarm! - y.daysToAlarm!)[0];
    const worst: AssetHealth["state"] = metrics.some((m) => m.state === "alarm") ? "alarm" : metrics.some((m) => m.state === "warn") || (soon && soon.daysToAlarm! <= 21) ? "warn" : "ok";
    const score = Math.max(5, Math.min(100, 100 - metrics.reduce((s, m) => s + (m.state === "alarm" ? 45 : m.state === "warn" ? 20 : 0) + (m.daysToAlarm != null ? Math.max(0, 25 - m.daysToAlarm) : 0), 0)));
    const forecast = worst === "alarm" ? `${metrics.find((m) => m.state === "alarm")!.label} is past the alarm limit. Service now to avoid a breakdown.`
      : soon ? `${soon.label} is trending ${LIMITS[soon.metric].down ? "down" : "up"}; likely to hit the alarm limit in about ${soon.daysToAlarm} days. Book service before then.`
        : worst === "warn" ? `${metrics.find((m) => m.state === "warn")!.label} is above normal but steady. Check at the next monthly service.` : "All readings normal and steady.";
    return { id: a.id, tag: a.tag, name: a.name, category: a.category, location: a.location, score, state: worst, metrics, forecast, openWo: wos.find((w) => w.location === a.location)?.number ?? null };
  }).sort((x, y) => x.score - y.score);
}
