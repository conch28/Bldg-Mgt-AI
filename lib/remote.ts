/** Client branding on the 3D map (BCDA, Pax Silica). */
export type ClientKey = "bcda" | "pax";
export const clientFrom = (v?: string | null): ClientKey | undefined => (v === "bcda" || v === "ncc" ? "bcda" : v === "pax" ? "pax" : undefined);

// Commands the phone remote may send to the 3D city map (shared by the API, the phone page and the map).
export const ASK_PRESETS = [
  "Which building uses the most power?",
  "Where is water being wasted?",
  "How much did we save today?",
  "What happens in a typhoon?",
  "Show me 2030",
  "Which buildings get an F?",
  "Take me to Pax Silica",
  "Are residents happier?",
];
export const REMOTE_CMD_LIST: string[] = [
  "present", "next", "prev", "end", "mute", "reset", "ask",
  "mode:districts", "mode:energy", "mode:water", "mode:alerts", "mode:grades", "mode:future", "storm:typhoon", "storm:heat",
  ...ASK_PRESETS.map((_, i) => `ask:${i}`),
];
