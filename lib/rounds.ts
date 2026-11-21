/**
 * Guard rounds: the fixed walk a guard does each shift, the one-tap problems they can log at each stop,
 * and the meters they read. No server imports, so the client form can use it too.
 * Checkpoint labels use the same words as work-order locations, so issues land on the right part of the 3D view.
 */

export type Checkpoint = { key: string; label: string; look: string };
export const CHECKPOINTS: Checkpoint[] = [
  { key: "lobby-a", label: "Tower A lobby", look: "Lights, main door and access reader, CCTV screen, cleanliness" },
  { key: "lobby-b", label: "Tower B lobby", look: "Lights, main door and access reader, CCTV screen, cleanliness" },
  { key: "gate", label: "Main gate and driveway", look: "Barrier arm, lights, drainage, no blocked fire lane" },
  { key: "parking-b1", label: "Parking B1", look: "Lights, leaks from ceiling, exhaust fans, fire extinguishers" },
  { key: "parking-b2", label: "Parking B2", look: "Lights, standing water, sump pump running, exhaust fans" },
  { key: "pump-room", label: "Pump room", look: "Water pumps, pressure gauge, leaks, unusual noise or smell" },
  { key: "genset", label: "Genset room", look: "Fuel level, battery charger light, leaks, room clear of storage" },
  { key: "elevators", label: "Elevator lobbies", look: "All 4 lifts running, call buttons, emergency phone" },
  { key: "hallways", label: "Hallways and fire exits", look: "Hallway lights, exit signs lit, fire doors closed, stairs clear" },
  { key: "pool", label: "Pool deck", look: "Pool lights, filter pump, gate lock, slippery tiles, lifebuoy" },
  { key: "amenity", label: "5th-floor gym and function rooms", look: "Aircon, lights, equipment, doors locked after hours" },
  { key: "garbage", label: "Garbage room", look: "Bins not overflowing, no pests, door closed, smell" },
  { key: "roof", label: "Roof deck", look: "Water tanks, drains clear, helipad lights, door locked" },
];

/** One-tap problems. Each maps to a work-order category, priority and response time. */
export type IssueKind = { key: string; label: string; category: string; priority: "LOW" | "MEDIUM" | "HIGH"; title: string };
export const ISSUES: IssueKind[] = [
  { key: "light", label: "Light out", category: "Electrical", priority: "LOW", title: "Light out" },
  { key: "leak", label: "Leak or water", category: "Plumbing", priority: "HIGH", title: "Water leak" },
  { key: "aircon", label: "Aircon", category: "Mechanical", priority: "MEDIUM", title: "Aircon not working" },
  { key: "power", label: "Power or outlet", category: "Electrical", priority: "HIGH", title: "Power problem" },
  { key: "water", label: "No water or low pressure", category: "Plumbing", priority: "HIGH", title: "No water or low pressure" },
  { key: "elevator", label: "Elevator", category: "Elevator", priority: "HIGH", title: "Elevator problem" },
  { key: "door", label: "Door, lock or gate", category: "Security", priority: "MEDIUM", title: "Door or lock problem" },
  { key: "fire", label: "Fire safety item", category: "Security", priority: "HIGH", title: "Fire safety item missing or broken" },
  { key: "dirty", label: "Dirty or smelly", category: "Housekeeping", priority: "LOW", title: "Needs cleaning" },
  { key: "pest", label: "Pests", category: "Housekeeping", priority: "LOW", title: "Pests seen" },
  { key: "hazard", label: "Trip or safety hazard", category: "Civil", priority: "MEDIUM", title: "Safety hazard" },
  { key: "other", label: "Something else", category: "Other", priority: "MEDIUM", title: "Problem found on rounds" },
];
export const SLA_HOURS = { HIGH: 4, MEDIUM: 24, LOW: 72 } as const;

export type Meter = { key: string; label: string; unit: string; hint: string; min: number; max: number };
export const METERS: Meter[] = [
  { key: "WATER_MAIN", label: "Main water meter", unit: "m³", hint: "The full number on the dial", min: 0, max: 99999999 },
  { key: "ELECTRIC_MAIN", label: "Common-area electric meter", unit: "kWh", hint: "The full number on the display", min: 0, max: 999999999 },
  { key: "GENSET_FUEL", label: "Genset fuel", unit: "%", hint: "From the tank gauge", min: 0, max: 100 },
  { key: "CISTERN", label: "Water tank level", unit: "%", hint: "From the roof tank gauge", min: 0, max: 100 },
];

/** Day shift 6 AM to 6 PM Manila, night shift otherwise. */
export const shiftOf = (d: Date) => {
  const h = Number(d.toLocaleString("en-US", { timeZone: "Asia/Manila", hour: "numeric", hour12: false })) % 24;
  return h >= 6 && h < 18 ? "DAY" : "NIGHT";
};
