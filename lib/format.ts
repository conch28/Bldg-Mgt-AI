export const TZ = "Asia/Manila";
export const peso = (n: number | { toString(): string }) =>
  "₱" + Math.round(Number(n)).toLocaleString("en-PH");
export const pesoK = (n: number) =>
  n >= 1e6 ? "₱" + (n / 1e6).toFixed(2) + "M" : "₱" + Math.round(n / 1000).toLocaleString("en-PH") + "k";
export const fmtTime = (d: Date) => d.toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
export const fmtDate = (d: Date) => d.toLocaleDateString("en-PH", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (d: Date) => d.toLocaleString("en-PH", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const monthLabel = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-PH", { month: "short", timeZone: "UTC" });
};
export const monthLong = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
};
/** Current billing period in Manila, e.g. "2026-11". APP_NOW lets a demo pin the clock. */
export function nowManila(): Date {
  return process.env.APP_NOW ? new Date(process.env.APP_NOW) : new Date();
}
export function currentPeriod(d = nowManila()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`;
}
export function addMonths(period: string, n: number) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
