/**
 * Demo data for the Data Center: asset specs (some missing or unverified on purpose), schedules linked
 * to safety equipment, a compliance register with one expired and one expiring item, contractor
 * credentials at different stages, and a few register sign-offs. All names, numbers and files are
 * fictional samples, marked SAMPLE in each file.
 */
import type { PrismaClient, User } from "@prisma/client";
import { pdf } from "./seed-v2";

type Ctx = { prisma: PrismaClient; manager: User; admin: User; president: User; buildingId: string; NOW: Date };
const DAY = 86400000;

export async function seedV7({ prisma, manager, admin, president, buildingId, NOW }: Ctx) {
  console.log("Data Center: asset registry, compliance register, contractor vetting…");
  const at = (d: number) => new Date(NOW.getTime() + d * DAY);
  const doc = async (title: string, category: string, lines: string[], daysAgo = 30) => {
    const data = pdf(title, ["SAMPLE DOCUMENT FOR THE DEMO. NOT A REAL CERTIFICATE OR MANUAL.", ...lines]);
    return prisma.document.create({ data: { title, category, visibility: "BOARD", fileName: title.replace(/[^\w]+/g, "-").toLowerCase() + ".pdf", mime: "application/pdf", size: data.length, data, uploadedBy: manager.name, createdAt: at(-daysAgo) } });
  };

  // Staff mobiles so urgent alerts can reach them (guard2 left blank on purpose: the register flags it)
  const phones: [string, string][] = [["admin@skyland.test", "+63 917 555 0100"], ["president@skyland.test", "+63 917 555 0102"], ["treasurer@skyland.test", "+63 917 555 0103"], ["guard@skyland.test", "+63 917 555 0104"]];
  for (const [email, phone] of phones) await prisma.user.updateMany({ where: { email, phone: null }, data: { phone } });

  // New safety equipment that the registry should have had all along
  const mk = (tag: string, name: string, category: string, location: string, years: number, life: number, cost: number, vendor: string) =>
    prisma.asset.create({ data: { tag, name, category, location, installedAt: at(-years * 365), lifeMonths: life, cost, vendor } });
  await mk("FP-MAIN-1", "Electric fire pump 750 GPM", "Fire protection", "Fire pump room", 13, 240, 1450000, "FireTech Philippines");
  await mk("FP-JOCKEY-1", "Jockey pump", "Fire protection", "Fire pump room", 13, 180, 165000, "FireTech Philippines");
  await mk("FA-PANEL-1", "Fire alarm control panel", "Fire protection", "Tower A ground floor FDAS room", 13, 180, 680000, "FireTech Philippines");
  await mk("EL-TX-1", "Main transformer 1,500 kVA", "Electrical", "Transformer vault", 13, 360, 3900000, "PowerGen Services");
  await mk("EL-MDP-1", "Main distribution panel", "Electrical", "Main electrical room", 13, 300, 2100000, "PowerGen Services");
  await mk("CC-NVR-1", "CCTV recorder (64 channels)", "Security", "Security office", 3, 72, 240000, "Guardian Shield Security");

  type Spec = { c: "SAFETY" | "HIGH"; man?: string; mod?: string; ser?: string; src?: string; rc?: number; ver?: boolean; owner?: string; manual?: boolean };
  const SPECS: Record<string, Spec> = {
    "EV-A1-DRIVE": { c: "SAFETY", man: "Kaito Elevator Co.", mod: "KX-1000 MRL", ser: "KX13-00871", src: "NAMEPLATE", rc: 5200000, ver: true, manual: true },
    "EV-A2-DRIVE": { c: "SAFETY", man: "Kaito Elevator Co.", mod: "KX-1000 MRL", ser: "KX13-00872", src: "NAMEPLATE", rc: 5200000, ver: true, manual: true },
    "EV-B3-DRIVE": { c: "SAFETY", man: "Kaito Elevator Co.", mod: "KX-1000 MRL", ser: "KX13-00873", src: "NAMEPLATE", rc: 5200000, ver: true, manual: true },
    "EV-B4-DRIVE": { c: "SAFETY", man: "Kaito Elevator Co.", mod: "KX-1000 MRL", ser: "KX13-00874", src: "CONTRACTOR", rc: 5200000, ver: false },
    "EL-GEN-1": { c: "SAFETY", man: "Volta Power Systems", mod: "VP-750S", ser: "VP750-1302-118", src: "NAMEPLATE", rc: 7400000, ver: true, manual: true },
    "FP-MAIN-1": { c: "SAFETY", man: "Aquaforce Pumps", mod: "AF-750E", ser: "AF7-2013-0457", src: "MANUAL", rc: 1800000, ver: true, manual: true },
    "FP-JOCKEY-1": { c: "SAFETY", man: "Aquaforce Pumps", mod: "AF-J15", src: "UNKNOWN" },
    "FA-PANEL-1": { c: "SAFETY", man: "Sentry Fire Systems", mod: "SF-4800", ser: "SF48-13-2290", src: "CONTRACTOR", rc: 950000, ver: false },
    "EL-TX-1": { c: "HIGH", man: "Luzon Transformer Corp.", ser: "LTC-1500-0331", src: "INVOICE", rc: 4500000 },
    "EL-MDP-1": { c: "HIGH", man: "Volta Power Systems", mod: "MDP-4000A", ser: "MDP4-13-019", src: "NAMEPLATE", rc: 2600000, ver: true },
    "PM-BOOST-1": { c: "HIGH", man: "AquaTech Pumps", mod: "AT-BP30", ser: "ATBP-20-1145", src: "NAMEPLATE", rc: 210000, ver: true },
    "PM-BOOST-2": { c: "HIGH", man: "AquaTech Pumps", mod: "AT-BP30", ser: "ATBP-25-2208", src: "NAMEPLATE", rc: 210000, ver: true },
    "PM-SUMP-B2": { c: "HIGH", man: "AquaTech Pumps", mod: "AT-SP10", ser: "ATSP-23-0912", src: "INVOICE", rc: 48000 },
    "EL-GEN-BAT": { c: "HIGH", man: "PowerMax", mod: "PMX-200Ah", ser: "PMX-26-55102", src: "INVOICE", rc: 13500, ver: true },
    "CC-NVR-1": { c: "HIGH", man: "Iris Security", mod: "IR-NVR64", ser: "IRN64-23-7781", src: "INVOICE", rc: 260000, ver: true },
  };
  for (const [tag, s] of Object.entries(SPECS)) {
    const a = await prisma.asset.findUnique({ where: { tag } }); if (!a) continue;
    let manualDocId: string | null = null;
    if (s.manual) manualDocId = (await doc(`Manual: ${a.name} (${s.mod})`, "Manuals", [`${s.man} ${s.mod}`, "Maintenance intervals: see section 6.", "Spare parts list: appendix B."], 200)).id;
    await prisma.asset.update({ where: { tag }, data: { criticality: s.c, manufacturer: s.man ?? null, model: s.mod ?? null, serial: s.ser ?? null, specSource: s.src ?? null, replacementCost: s.rc ?? null, ownerName: s.owner ?? manager.name, manualDocId, ...(s.ver ? { verifiedAt: at(-20), verifiedBy: admin.name } : {}) } });
  }

  // Link schedules to equipment and record where each interval comes from
  const link = async (match: string, tag: string | null, src: string) => { await prisma.pMTask.updateMany({ where: { task: match }, data: { ...(tag ? { assetTag: tag } : {}), intervalSource: src } }); };
  await link("Weekly churn test", "FP-MAIN-1", "STATUTORY");
  await link("No-load run and battery check", "EL-GEN-1", "MANUFACTURER");
  await link("Monthly preventive maintenance", "EV-A1-DRIVE", "CONTRACT");
  await link("Annual DOLE load test and permit", null, "STATUTORY");
  await link("Quarterly inspection", "FA-PANEL-1", "UNVERIFIED");
  await link("Monthly pressure check", null, "STATUTORY");
  await link("Cleaning and disinfection", null, "STATUTORY");
  await link("Thermal scan and oil test", "EL-TX-1", "ENGINEER");
  for (const [tag, name] of [["EV-A2-DRIVE", "Tower A lift 2"], ["EV-B3-DRIVE", "Tower B lift 3"], ["EV-B4-DRIVE", "Tower B lift 4"]])
    await prisma.pMTask.create({ data: { asset: name, assetTag: tag, task: "Monthly preventive maintenance", frequencyDays: 30, lastDone: at(-26), nextDue: at(4), vendor: "LiftCare Elevators", compliance: true, intervalSource: "CONTRACT" } });
  await prisma.pMTask.create({ data: { asset: "Main distribution panel", assetTag: "EL-MDP-1", task: "Infrared scan and tightening", frequencyDays: 365, lastDone: at(-200), nextDue: at(165), vendor: "PowerGen Services", intervalSource: "ENGINEER" } });
  // FP-JOCKEY-1 deliberately has no schedule: the checks raise it as P0.

  // Compliance register (default PH checklist for a Makati condominium; rules confirmed for some)
  const counsel = "Atty. R. Mendoza (counsel)", safety = "Engr. L. Bautista (safety officer)";
  type C = [string, string, string, string | null, number | null, number | null, boolean, "VERIFIED" | "PENDING", string | null, string | null, string];
  const C_: C[] = [
    ["Fire Safety Inspection Certificate (FSIC)", "CERTIFICATE", "Bureau of Fire Protection, Makati", "FSIC-R-0000-2026", -285, 80, true, "VERIFIED", safety, "Book the BFP inspection 60 days before expiry; close fire-safety tickets first.", "Required by the Fire Code (RA 9514)."],
    ["Certificate of Occupancy", "CERTIFICATE", "Office of the Building Official, Makati", "CO-2013-0000", -4700, null, true, "VERIFIED", counsel, "No renewal. Keep the original in the admin safe.", "From turnover."],
    ["Elevator Certificates of Operation (4 cars)", "PERMIT", "Office of the Building Official, Makati", "EO-2026-0000 to 0003", -340, 25, true, "VERIFIED", safety, "Annual inspection and load test by the elevator contractor, then OBO renewal.", ""],
    ["Annual electrical inspection certificate", "CERTIFICATE", "Office of the Building Official, Makati", "EI-2026-0000", -120, 245, true, "VERIFIED", null, "Electrical engineer's annual inspection report.", ""],
    ["Sanitary permit", "PERMIT", "Makati Health Department", "SP-2026-0000", -40, 325, true, "PENDING", null, "Yearly with the business permit; water test results attached.", ""],
    ["Genset Permit to Operate (air emissions)", "PERMIT", "DENR Environmental Management Bureau, NCR", "PTO-NCR-0000-2025", -375, -10, true, "VERIFIED", counsel, "Apply online with the stack emission test. Overdue.", ""],
    ["Wastewater discharge permit", "PERMIT", "DENR Environmental Management Bureau, NCR", "DP-NCR-0000-2026", -60, 305, true, "VERIFIED", null, "Quarterly effluent tests by an accredited lab.", ""],
    ["Potable water test (bacteriological)", "CERTIFICATE", "DOH-accredited laboratory", "LAB-0000", -150, 30, true, "VERIFIED", null, "Every 6 months, after tank cleaning.", ""],
    ["Fire and all-risk property insurance", "INSURANCE", "Sample Insurance Corp.", "POL-SAMPLE-0001", -235, 130, true, "VERIFIED", counsel, "Renew 30 days before expiry; review sum insured against replacement cost.", ""],
    ["Comprehensive general liability insurance", "INSURANCE", "Sample Insurance Corp.", "POL-SAMPLE-0002", -235, 130, true, "VERIFIED", counsel, "", ""],
    ["Data Protection Officer registration", "PRIVACY", "National Privacy Commission", null, null, null, true, "PENDING", null, "Check whether NPC registration applies (NPC Circular 2022-04).", "No file yet."],
    ["Emergency evacuation plan (per tower)", "PLAN", "Prepared by the safety officer; posted per floor", "EVAC-2026", -90, 275, true, "VERIFIED", safety, "Review yearly and after renovations.", ""],
    ["Directors and officers insurance", "INSURANCE", "Sample Insurance Corp.", "POL-SAMPLE-0003", -235, 130, false, "VERIFIED", null, "", "Optional; recommended for the board."],
  ];
  for (const [title, kind, authority, docNumber, issued, expires, mandatory, status, confirmed, renewal, note] of C_) {
    const file = title.startsWith("Data Protection") ? null : (await doc(`Compliance: ${title}`, "Compliance", [authority, docNumber ? `No. ${docNumber}` : "", expires != null ? `Valid until ${at(expires).toDateString()}` : "No expiry"], issued != null ? -issued : 30)).id;
    await prisma.complianceItem.create({ data: { buildingId, title, kind, authority, docNumber, issuedAt: issued != null ? at(issued) : null, expiresAt: expires != null ? at(expires) : null, renewal: renewal || null, note: note || null, mandatory, status, documentId: file, ownerName: "Operations head", enteredBy: manager.name,
      ...(status === "VERIFIED" ? { verifiedBy: admin.name, verifiedAt: at(-15) } : {}), ...(confirmed ? { ruleConfirmedBy: confirmed, ruleConfirmedAt: at(-30) } : {}) } });
  }

  // Contractor credentials at different stages
  const V = Object.fromEntries((await prisma.vendor.findMany()).map((v) => [v.name, v]));
  type K = [string, string, string | null, number | null, "VERIFIED" | "PENDING"];
  const CR: Record<string, K[]> = {
    "LiftCare Elevators": [["SEC_DTI", "CS2008-00000", null, null, "VERIFIED"], ["MAYORS_PERMIT", "BP-2026-00000", "City of Makati", 40, "VERIFIED"], ["BIR_2303", "000-000-000-000", "BIR RDO 47", null, "VERIFIED"], ["INSURANCE", "CGL-0000", "Sample Insurance Corp.", 230, "VERIFIED"], ["TECH_LICENSE", "Manufacturer-accredited installer", "Kaito Elevator Co.", 300, "VERIFIED"]],
    "PowerGen Services": [["SEC_DTI", "CS2015-00000", null, null, "VERIFIED"], ["MAYORS_PERMIT", "BP-2026-00001", "City of Pasig", 40, "VERIFIED"], ["BIR_2303", "000-000-000-001", null, null, "VERIFIED"], ["INSURANCE", "CGL-0001", "Sample Insurance Corp.", 325, "VERIFIED"], ["TECH_LICENSE", "PEE licence (electrical engineer)", "PRC", 500, "VERIFIED"]],
    "Guardian Shield Security": [["SEC_DTI", "CS2001-00000", null, null, "VERIFIED"], ["MAYORS_PERMIT", "BP-2026-00002", "City of Makati", 40, "VERIFIED"], ["BIR_2303", "000-000-000-002", null, null, "VERIFIED"], ["INSURANCE", "CGL-0002", "Sample Insurance Corp.", 120, "VERIFIED"], ["TECH_LICENSE", "Licence to operate (PNP-SOSIA)", "PNP SOSIA", 70, "PENDING"]],
    "CleanPro Facility Services": [["SEC_DTI", "CS2011-00000", null, null, "VERIFIED"], ["MAYORS_PERMIT", "BP-2026-00003", "City of Taguig", 40, "VERIFIED"], ["INSURANCE", "CGL-0003", "Sample Insurance Corp.", 22, "VERIFIED"]],
    "FireTech Philippines": [["SEC_DTI", "CS2009-00000", null, null, "PENDING"], ["MAYORS_PERMIT", "BP-2026-00004", "City of Makati", 40, "PENDING"], ["BIR_2303", "000-000-000-004", null, null, "PENDING"], ["INSURANCE", "CGL-0004", "Sample Insurance Corp.", 140, "PENDING"]],
    "GreenShield Pest Control": [["SEC_DTI", "DTI-0000000", null, null, "VERIFIED"], ["MAYORS_PERMIT", "BP-2026-00005", "City of Makati", 40, "VERIFIED"], ["BIR_2303", "000-000-000-005", null, null, "VERIFIED"], ["INSURANCE", "CGL-0005", "Sample Insurance Corp.", -5, "VERIFIED"]],
    "AquaSafe Water Systems": [["SEC_DTI", "CS2016-00000", null, null, "VERIFIED"], ["BIR_2303", "000-000-000-006", null, null, "VERIFIED"]],
  };
  for (const [name, list] of Object.entries(CR)) {
    const v = V[name]; if (!v) continue;
    for (const [kind, number, issuer, exp, status] of list) {
      const file = (await doc(`${name}: ${kind.replace("_", " ")}`, "Contracts", [name, `No. ${number}`], 60)).id;
      await prisma.vendorCredential.create({ data: { vendorId: v.id, kind, number, issuer, expiresAt: exp != null ? at(exp) : null, documentId: file, status, enteredBy: manager.name, ...(status === "VERIFIED" ? { verifiedBy: admin.name, verifiedAt: at(-25) } : {}) } });
    }
  }

  // Plans, drill record and register sign-offs
  await doc("As-built architectural plans (Towers A and B)", "Plans", ["Sheets A-001 to A-145"], 400);
  await doc("Fire protection plans (sprinkler and FDAS)", "Plans", ["Sheets FP-001 to FP-060"], 400);
  await doc("Fire and evacuation drill report, October 2026", "Safety", ["Participants: 212 residents, 18 staff", "Evacuation time: Tower A 9m40s, Tower B 11m05s", "Findings: stair B-15 exit sign out (fixed)"], 35);
  for (const [reqId, ownerName] of [["prop-profile", manager.name], ["unit-register", "Operations head"], ["compliance-register", "Operations head"], ["pm-coverage", manager.name], ["budget", "Board Treasurer"]])
    await prisma.readinessSignoff.create({ data: { buildingId, reqId, ownerName, approvedBy: president.name, approvedAt: at(-10) } });
}
