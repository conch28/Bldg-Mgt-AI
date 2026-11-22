/**
 * Contractor vetting. A contractor is "Vetted" only when every required credential was checked by a
 * person other than who entered it and has not expired. The score is a transparent breakdown of
 * verified evidence; parts with no evidence are left out and shown as "no data", never guessed.
 */
import type { Vendor, VendorCredential } from "@prisma/client";

export const CRED_KINDS: Record<string, { label: string; issuer: string; expires: boolean }> = {
  SEC_DTI: { label: "SEC or DTI registration", issuer: "SEC / DTI", expires: false },
  MAYORS_PERMIT: { label: "Mayor's / business permit", issuer: "City or municipal hall", expires: true },
  BIR_2303: { label: "BIR Certificate of Registration (2303)", issuer: "BIR", expires: false },
  INSURANCE: { label: "Insurance (CGL / workers)", issuer: "Insurer", expires: true },
  PCAB: { label: "PCAB contractor's licence", issuer: "PCAB", expires: true },
  TECH_LICENSE: { label: "Technical licence or accreditation", issuer: "PRC / manufacturer / agency", expires: true },
  SAFETY: { label: "Safety program or DOLE accreditation", issuer: "DOLE", expires: true },
  REFERENCE: { label: "Client reference (checked by phone)", issuer: "Previous client", expires: false },
};

/** What each kind of contractor must show. Defaults: the client confirms or changes them. */
export function requiredKinds(service: string): string[] {
  const s = service.toLowerCase();
  const base = ["SEC_DTI", "MAYORS_PERMIT", "BIR_2303", "INSURANCE"];
  if (/elevator|lift|fire|electric|genset|generator|hvac|aircon/.test(s)) return [...base, "TECH_LICENSE"];
  if (/security/.test(s)) return [...base, "TECH_LICENSE"]; // PNP-SOSIA licence to operate
  if (/construct|renovat|civil|waterproof/.test(s)) return [...base, "PCAB"];
  return base;
}

export type VendorScore = {
  vetted: boolean; missing: string[]; expired: string[]; pending: string[];
  parts: { key: string; label: string; weight: number; points: number | null; why: string }[];
  score: number | null; evidence: number; // evidence = share of the 100 points backed by data
};

export function scoreVendor(v: Vendor, creds: VendorCredential[], now: Date, extra: { quoteRatio?: number | null; overduePm?: number | null }): VendorScore {
  const req = requiredKinds(v.service);
  const live = (k: string) => creds.find((c) => c.kind === k && c.status === "VERIFIED" && (!c.expiresAt || c.expiresAt > now));
  const missing = req.filter((k) => !creds.some((c) => c.kind === k && c.status !== "REJECTED"));
  const expired = req.filter((k) => creds.some((c) => c.kind === k && c.status === "VERIFIED" && c.expiresAt && c.expiresAt <= now) && !live(k));
  const pending = req.filter((k) => !live(k) && creds.some((c) => c.kind === k && c.status === "PENDING"));
  const ok = req.filter((k) => live(k)).length;
  const parts: VendorScore["parts"] = [
    { key: "qual", label: "Verified qualifications", weight: 40, points: Math.round((ok / req.length) * 40), why: `${ok} of ${req.length} required credentials verified and current` },
    { key: "perf", label: "Service quality", weight: 25, points: v.rating != null ? Math.round((Number(v.rating) / 5) * 25) : null, why: v.rating != null ? `Rating ${Number(v.rating).toFixed(1)} of 5 from ticket ratings and board review` : "No ratings yet" },
    { key: "price", label: "Price vs other quotes", weight: 20, points: extra.quoteRatio != null ? Math.round(Math.min(1, extra.quoteRatio) * 20) : null, why: extra.quoteRatio != null ? `Quotes average ${Math.round((1 / extra.quoteRatio - 1) * 100)}% above the lowest comparable quote` : "No competing quotes on file" },
    { key: "rel", label: "Reliability", weight: 15, points: extra.overduePm != null ? Math.max(0, 15 - extra.overduePm * 5) : null, why: extra.overduePm != null ? (extra.overduePm ? `${extra.overduePm} scheduled job(s) overdue` : "All scheduled jobs on time") : "No scheduled jobs to measure" },
  ];
  const known = parts.filter((p) => p.points != null);
  const evidence = known.reduce((s, p) => s + p.weight, 0);
  const score = evidence ? Math.round((known.reduce((s, p) => s + p.points!, 0) / evidence) * 100) : null;
  return { vetted: ok === req.length, missing, expired, pending, parts, score, evidence };
}
