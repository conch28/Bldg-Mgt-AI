import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { fmtDate, nowManila } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Visitor pass · Skyland Plaza", robots: { index: false } };

/** Public pass page a visitor opens from Messenger or Viber. Shows only the code, the visitor's name and the dates. */
export default async function GuestPass({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const p = code.length === 6 ? await prisma.pass.findUnique({ where: { code }, select: { code: true, name: true, kind: true, validFrom: true, validTo: true, checkedOut: true } }) : null;
  const now = nowManila();
  const valid = p && p.validTo >= now && !p.checkedOut;
  const qr = p && valid ? await QRCode.toString(`SKYLAND-PASS:${p.code}`, { type: "svg", margin: 0 }) : "";
  return (
    <main className="guestpass">
      <div className="card" style={{ maxWidth: 380, margin: "40px auto", textAlign: "center" }}>
        <div className="hint">Skyland Plaza · Visitor pass</div>
        {!p ? <h2 style={{ marginTop: 12 }}>This pass doesn&apos;t exist.</h2> : !valid ? <h2 style={{ marginTop: 12 }}>This pass has expired.</h2> : <>
          <h2 style={{ margin: "8px 0 14px" }}>Hi {p.name.split(" ")[0]}!</h2>
          <div className="qr" style={{ width: 220, margin: "0 auto" }} dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="pass-code" style={{ marginTop: 14 }}>{p.code}</div>
          <p className="hint" style={{ marginTop: 10 }}>Show this QR to the lobby guard with a valid ID. Valid {fmtDate(p.validFrom)}{p.validTo.getTime() - p.validFrom.getTime() > 86400000 ? ` to ${fmtDate(p.validTo)}` : ""}.</p>
          <p className="hint">Sen. Gil Puyat Ave cor. Tindalo St., Makati</p>
        </>}
      </div>
    </main>
  );
}
