import Link from "next/link";

export default function DataTabs({ on }: { on: string }) {
  const T = [["/data", "Overview"], ["/data/assets", "Assets & QR"], ["/data/compliance", "Permits & insurance"], ["/data/contractors", "Contractor vetting"], ["/data/register", "Readiness register"]];
  return <div className="tabs">{T.map(([h, l]) => <Link key={h} href={h} className={"chip" + (on === h ? " on" : "")}>{l}</Link>)}</div>;
}

