/**
 * Makati weather from Open-Meteo (free, no key), cached for 30 minutes, plus the prep checklist the building
 * should run before heavy rain or a typhoon. If the forecast can't be reached, we say so and show typical
 * weather for the month instead of guessing.
 */
import { nowManila } from "./format";

export const MAKATI = { lat: 14.5547, lon: 121.0244, name: "Makati" };

export type WxDay = { date: string; code: number; max: number; min: number; rain: number; rainChance: number; gust: number };
export type WxRisk = "storm" | "rain" | "heat" | "ok";
export type Weather = {
  live: boolean; source: string; updated: number;
  now: { temp: number; code: number; feels: number; humidity: number; wind: number } | null;
  days: WxDay[]; risk: WxRisk; headline: string; riskDay: WxDay | null;
};

const WMO: Record<number, [string, string]> = {
  0: ["Clear", "☀️"], 1: ["Mostly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Cloudy", "☁️"], 45: ["Fog", "🌫️"], 48: ["Fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"], 61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"], 82: ["Violent rain showers", "⛈️"], 95: ["Thunderstorms", "⛈️"], 96: ["Thunderstorms with hail", "⛈️"], 99: ["Severe thunderstorms", "⛈️"],
};
export const wxWord = (code: number) => (WMO[code] ?? ["Mixed", "🌥️"])[0];
export const wxIcon = (code: number) => (WMO[code] ?? ["Mixed", "🌥️"])[1];

/** PAGASA's Signal No. 1 starts at 39 km/h sustained winds; gusts over ~60 km/h mean loose items fly. */
function assess(days: WxDay[]): { risk: WxRisk; day: WxDay | null; headline: string } {
  const next = days.slice(0, 3);
  const storm = next.find((d) => d.gust >= 60 || d.rain >= 50 || d.code >= 95 && d.rain >= 30);
  if (storm) return { risk: "storm", day: storm, headline: `Storm-level weather ${dayWord(storm.date)}: up to ${Math.round(storm.rain)} mm of rain and gusts of ${Math.round(storm.gust)} km/h. Start the typhoon prep list.` };
  const rain = next.find((d) => d.rain >= 20 || (d.rainChance >= 80 && d.rain >= 10));
  if (rain) return { risk: "rain", day: rain, headline: `Heavy rain ${dayWord(rain.date)} (${Math.round(rain.rain)} mm). Clear drains and check the B2 sump pump.` };
  const heat = next.find((d) => d.max >= 35);
  if (heat) return { risk: "heat", day: heat, headline: `Very hot ${dayWord(heat.date)} (${Math.round(heat.max)}°C). Expect high aircon load; pre-cool the lobby and check the chillers.` };
  return { risk: "ok", day: null, headline: "No weather risks in the next 3 days." };
}

export function dayWord(date: string) {
  const today = nowManila().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const tmr = new Date(nowManila().getTime() + 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  if (date === today) return "today";
  if (date === tmr) return "tomorrow";
  return "on " + new Date(date + "T12:00:00+08:00").toLocaleDateString("en-PH", { weekday: "long", timeZone: "Asia/Manila" });
}

/** Typical Metro Manila weather by month (approximate climate normals). Used only when the forecast is unreachable. */
const NORMALS: [number, number, number][] = [ // max °C, min °C, rain mm/day
  [30, 23, 0.6], [31, 23, 0.4], [33, 24, 0.5], [34, 25, 0.8], [34, 26, 4.5], [33, 26, 9.5],
  [32, 25, 13], [31, 25, 15], [32, 25, 12], [31, 25, 7.5], [31, 24, 4.5], [30, 23, 2.2],
];

function typical(): Weather {
  const now = nowManila();
  const days: WxDay[] = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now.getTime() + i * 86400000);
    const [max, min, rain] = NORMALS[Number(d.toLocaleString("en-US", { timeZone: "Asia/Manila", month: "numeric" })) - 1];
    return { date: d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }), code: rain > 6 ? 80 : 2, max, min, rain, rainChance: rain > 6 ? 60 : 30, gust: 25 };
  });
  return { live: false, source: "Typical weather for this month (live forecast unavailable)", updated: now.getTime(), now: null, days, risk: "ok", riskDay: null, headline: "Live forecast unavailable right now. Showing typical weather for the month." };
}

/** A sample storm forecast for demos and drills: /advisor?wx=storm */
export function stormDrill(): Weather {
  const now = nowManila();
  const ymd = (i: number) => new Date(now.getTime() + i * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const days: WxDay[] = [
    { date: ymd(0), code: 3, max: 30, min: 25, rain: 6, rainChance: 70, gust: 35 },
    { date: ymd(1), code: 65, max: 27, min: 24, rain: 88, rainChance: 100, gust: 85 },
    { date: ymd(2), code: 63, max: 28, min: 24, rain: 42, rainChance: 95, gust: 55 },
    { date: ymd(3), code: 80, max: 30, min: 25, rain: 12, rainChance: 70, gust: 30 },
    { date: ymd(4), code: 2, max: 31, min: 25, rain: 1, rainChance: 30, gust: 20 },
  ];
  const a = assess(days);
  return { live: false, source: "Typhoon drill (sample forecast, not real)", updated: now.getTime(), now: { temp: 29, code: 3, feels: 34, humidity: 84, wind: 22 }, days, risk: a.risk, riskDay: a.day, headline: a.headline };
}

export async function getWeather(opts: { drill?: boolean } = {}): Promise<Weather> {
  if (opts.drill || process.env.WEATHER_DRILL === "1") return stormDrill();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${MAKATI.lat}&longitude=${MAKATI.lon}`
    + "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m"
    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max"
    + "&timezone=Asia%2FManila&forecast_days=5";
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3500);
    const r = await fetch(url, { next: { revalidate: 1800 }, signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const d = j.daily;
    const days: WxDay[] = d.time.map((date: string, i: number) => ({
      date, code: d.weather_code[i] ?? 0, max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
      rain: d.precipitation_sum[i] ?? 0, rainChance: d.precipitation_probability_max[i] ?? 0, gust: d.wind_gusts_10m_max[i] ?? 0,
    }));
    const c = j.current;
    const a = assess(days);
    return {
      live: true, source: "Open-Meteo forecast for Makati, updated every 30 min", updated: Date.now(),
      now: c ? { temp: c.temperature_2m, code: c.weather_code, feels: c.apparent_temperature, humidity: c.relative_humidity_2m, wind: c.wind_speed_10m } : null,
      days, risk: a.risk, riskDay: a.day, headline: a.headline,
    };
  } catch {
    return typical();
  }
}

/** What the building team does before bad weather. Order matters: the slow jobs first. */
export const PREP: Record<"storm" | "rain" | "heat", { who: string; task: string }[]> = {
  storm: [
    { who: "Engineering", task: "Fill the genset to 100% fuel and run a 15-minute load test" },
    { who: "Engineering", task: "Test both B2 sump pumps and the backup float switch" },
    { who: "Housekeeping", task: "Clear roof, pool-deck and driveway drains of leaves" },
    { who: "Security", task: "Put sandbags and the flood barrier at the B2 ramp" },
    { who: "Housekeeping", task: "Stack and tie down pool-deck furniture and umbrellas; close the helipad" },
    { who: "Manager", task: "Send residents the storm advisory (balcony items, park at B1, stock water)" },
    { who: "Engineering", task: "Fill the roof water tanks; park the lifts on the lobby floor if power is lost" },
    { who: "Security", task: "Charge radios and flashlights; post the emergency hotline list at both lobbies" },
  ],
  rain: [
    { who: "Housekeeping", task: "Clear roof and driveway drains" },
    { who: "Engineering", task: "Check the B2 sump pump is on automatic" },
    { who: "Security", task: "Put wet-floor signs and mats at both lobbies" },
    { who: "Manager", task: "Remind residents to keep balcony drains clear" },
  ],
  heat: [
    { who: "Engineering", task: "Clean chiller condenser coils and check refrigerant pressure" },
    { who: "Engineering", task: "Raise common-area aircon setpoints to 25°C to avoid peak demand charges" },
    { who: "Manager", task: "Remind residents to stay hydrated; check on senior residents living alone" },
  ],
};

/** Plain tips for residents, English and Taglish. */
export const RESIDENT_TIP: Record<WxRisk, { en: string; tl: string } | null> = {
  storm: { en: "Bring in balcony plants and furniture, charge your phones and power banks, keep drinking water, and park at B1 instead of B2.", tl: "Ipasok po ang mga halaman at gamit sa balcony, i-charge ang phone at power bank, mag-ipon ng inuming tubig, at sa B1 na po mag-park imbes na B2." },
  rain: { en: "Heavy rain is coming. Please keep your balcony drain clear and close windows when you go out.", tl: "Malakas na ulan po ang paparating. Paki-linis ang drain ng balcony at isara ang bintana bago umalis." },
  heat: { en: "Very hot day ahead. Set your aircon to 25°C to save on your Meralco bill, and drink plenty of water.", tl: "Sobrang init po bukas. I-set ang aircon sa 25°C para tipid sa Meralco, at uminom ng maraming tubig." },
  ok: null,
};
