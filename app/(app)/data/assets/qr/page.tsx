import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

/** Printable QR labels (A4, 3 across). Each label opens the asset page after sign-in. */
export default async function QrLabels({ searchParams: sp }: { searchParams: { f?: string } }) {
  await requireRole("BOARD", "MANAGER", "ADMIN");
  const where = sp.f === "key" ? { criticality: { in: ["SAFETY", "HIGH"] } } : {};
  const assets = await prisma.asset.findMany({ where, orderBy: { tag: "asc" }, take: 300, select: { tag: true, name: true, location: true } });
  const h = headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const labels = await Promise.all(assets.map(async (a) => ({ ...a, qr: await QRCode.toDataURL(`${base}/data/assets/${encodeURIComponent(a.tag)}`, { margin: 0, width: 160 }) })));
  return (
    <>
      <PageHead title="QR labels" sub={`${labels.length} labels. Print on sticker paper and stick near each nameplate.`} back="/data/assets" right={<PrintButton />} />
      <main className="view">
        <style>{`.qrsheet{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}.qrlabel{border:1px dashed var(--line);border-radius:8px;padding:10px;display:flex;gap:10px;align-items:center;background:#fff;color:#111;break-inside:avoid}.qrlabel img{width:72px;height:72px}.qrlabel b{font-family:ui-monospace,monospace;font-size:13px}.qrlabel small{display:block;font-size:11px;color:#444}
@media print{.side,.mtop,.tabbar,header.top,.overdue-banner,.sos-banner{display:none!important}.main{margin:0!important;padding:0!important}.qrsheet{grid-template-columns:repeat(3,1fr)}}`}</style>
        <div className="qrsheet">{labels.map((l) => (
          <div className="qrlabel" key={l.tag}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.qr} alt="" />
            <div><b>{l.tag}</b><small>{l.name}</small><small>{l.location}</small><small>Scan to see history or report a fault</small></div>
          </div>))}</div>
      </main>
    </>
  );
}
