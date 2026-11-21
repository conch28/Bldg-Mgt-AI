/**
 * Layout of Skyland Plaza (Sen. Gil Puyat Ave cor. Tindalo St., Makati): two matching residential
 * towers on a shared podium. Used by the seed, the 3D view and the 2D view. No server imports, so
 * client components can use it too.
 *
 * What public sources say (Nov 2026) and what is our assumption. Change the numbers here once the
 * association confirms them; the seed, the 3D model and the 2D view all follow.
 *   Confirmed by a source:
 *   - Twin towers, residential (Lamudi, Housal); listings call them Tower A and Tower B ("1904 B").
 *   - 25 floors (SkyscraperPage, Tower B); bi-level 4BR penthouses on floors 24-25, ~300 sqm (Lamudi, Housal).
 *   - 3BR units of 130, 137 and 187 sqm (Lamudi, Housal, PH Real Estate).
 *   - Gym on the 5th level, pool, kids' play area, function rooms, helipad (Lamudi).
 *   - Two-level parking garage; two elevators per tower (Lamudi).
 *   Our assumption (not published anywhere we could find):
 *   - 4 units per floor (stacks 01-04), with 2 penthouses per tower.
 *   - Stack 04 is a ~90 sqm 2BR; residential floors 2-4 and 6-23; 5th floor is the amenity level.
 *   - The pool deck sits on the podium between the towers; the helipad is on Tower A.
 */

export const SITE = {
  name: "Skyland Plaza",
  city: "Makati",
  address: "Sen. Gil Puyat Ave cor. Tindalo St., Makati",
  floors: 25,
  amenityFloor: 5,
  penthouseFloor: 24, // bi-level: 24 and 25
};

export type TowerId = "A" | "B";
export const TOWERS: { id: TowerId; label: string; nick: string }[] = [
  { id: "A", label: "Tower A", nick: "Skyland 1" },
  { id: "B", label: "Tower B", nick: "Skyland 2" },
];
export const towerLabel = (t: string) => TOWERS.find((x) => x.id === t)?.label ?? `Tower ${t}`;

/** Regular floors: 4 units each. */
export const STACKS = ["01", "02", "03", "04"] as const;
export const STACK_INFO: Record<string, { sqm: number; beds: number; note: string }> = {
  "01": { sqm: 187, beds: 3, note: "3BR corner" },
  "02": { sqm: 137, beds: 3, note: "3BR" },
  "03": { sqm: 130, beds: 3, note: "3BR" },
  "04": { sqm: 90, beds: 2, note: "2BR (size assumed)" },
};
/** Penthouses: 2 per tower, each spanning floors 24-25. */
export const PH_STACKS = ["01", "02"] as const;
export const PH_INFO = { sqm: 300, beds: 4, note: "4BR bi-level penthouse" };

export const residentialFloors = () => Array.from({ length: SITE.penthouseFloor - 2 }, (_, i) => i + 2).filter((f) => f !== SITE.amenityFloor);

/** Every unit in the building: code like "1202B" = floor 12, stack 02, Tower B. */
export function allUnits() {
  const out: { code: string; tower: TowerId; floor: number; stack: string; sqm: number; beds: number; penthouse: boolean }[] = [];
  for (const t of TOWERS) {
    for (const f of residentialFloors()) for (const s of STACKS) out.push({ code: `${f}${s}${t.id}`, tower: t.id, floor: f, stack: s, sqm: STACK_INFO[s].sqm, beds: STACK_INFO[s].beds, penthouse: false });
    for (const s of PH_STACKS) out.push({ code: `${SITE.penthouseFloor}${s}${t.id}`, tower: t.id, floor: SITE.penthouseFloor, stack: s, sqm: PH_INFO.sqm, beds: PH_INFO.beds, penthouse: true });
  }
  return out;
}

const UNIT_RE = /^(\d{1,2})(\d{2})([A-Z])$/i;
export const isUnitCode = (s: string) => UNIT_RE.test(s.trim());
/** "1202B" → { floor: 12, stack: "02", tower: "B" } */
export function parseUnit(code: string): { floor: number; stack: string; tower: string; penthouse: boolean } | null {
  const m = code.trim().toUpperCase().match(UNIT_RE);
  if (!m) return null;
  const floor = Number(m[1]);
  return { floor, stack: m[2], tower: m[3], penthouse: floor >= SITE.penthouseFloor };
}
