/**
 * Typhoon mode: which parts of Skyland Plaza are at risk for a given forecast, and the active storm.
 * Deterministic from the forecast (rain mm, gusts km/h), so it works with no AI key.
 */
import { prisma } from "./db";
import type { Weather } from "./weather";

export type Risk = "high" | "medium" | "low";
export type FloodZone = { id: string; name: string; risk: Risk; why: string; todo: string };

export function floodRisk(w: Weather): FloodZone[] {
  const d = w.riskDay ?? w.days.slice(0, 3).reduce((a, b) => (b.rain + b.gust > a.rain + a.gust ? b : a), w.days[0]);
  const rain = d?.rain ?? 0, gust = d?.gust ?? 0;
  const lvl = (hi: boolean, mid: boolean): Risk => (hi ? "high" : mid ? "medium" : "low");
  return [
    { id: "b2", name: "Basement parking B2", risk: lvl(rain >= 50, rain >= 20), why: `Lowest level; the sump pump has to keep up with ${Math.round(rain)} mm of rain.`, todo: "Test both sump pumps and the float switch; ask owners to move cars up to B1 or the street-level slots." },
    { id: "b1", name: "Basement parking B1 and ramp", risk: lvl(rain >= 80, rain >= 40), why: "Street water can run down the driveway ramp.", todo: "Put sandbags across the ramp lip and clear the trench drain." },
    { id: "lobby", name: "Ground-floor lobbies and driveway", risk: lvl(rain >= 80, rain >= 30), why: "Gil Puyat and Tindalo St. flood in heavy downpours.", todo: "Sandbags at both lobby doors; move the guard desk electronics off the floor." },
    { id: "deck", name: "Pool deck and 5th-floor amenities", risk: lvl(gust >= 60, gust >= 45), why: `Gusts up to ${Math.round(gust)} km/h on the open podium.`, todo: "Stack and tie down loungers and umbrellas; close the pool; clear the deck drains." },
    { id: "high", name: "High floors (18-25) and penthouses", risk: lvl(gust >= 70, gust >= 50), why: "Wind pressure is highest up top; balcony doors and window seals leak first.", todo: "Remind owners to bring in plants and furniture, close and lock sliding doors, and towel the sills." },
    { id: "roof", name: "Roof, helipad and water tanks", risk: lvl(gust >= 60, gust >= 45), why: "Loose roof items become projectiles; tank covers can lift.", todo: "Secure tank covers and antennas; lock roof access." },
    { id: "power", name: "Power and lifts", risk: lvl(gust >= 60 || rain >= 80, gust >= 45 || rain >= 40), why: "Brownouts are common in signal 2+ storms.", todo: "Fuel the genset to full, test the transfer switch, and park one lift per tower at the lobby if power is lost." },
  ];
}

export const activeStorm = () => prisma.stormEvent.findFirst({ where: { phase: { not: "CLOSED" } }, orderBy: { startedAt: "desc" } });
