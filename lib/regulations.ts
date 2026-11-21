/**
 * Curated Philippine rules and government updates that matter to a Makati condominium corporation.
 * Written and reviewed by people, not generated live, because a wrong legal summary is worse than none.
 * Each item links to the agency so the board can check the current text. Update REVIEWED when you edit.
 */

export const REVIEWED = "2026-11-21";

export type Reg = {
  key: string; agency: string; title: string; summary: string; action: string;
  tag: "Deadline" | "Safety" | "Tax" | "Privacy" | "Governance" | "Utilities" | "Weather";
  when?: string; // when it applies, in plain words
  source: string; url: string; priority: 1 | 2 | 3; // 1 = act now
};

export const REGULATIONS: Reg[] = [
  {
    key: "fsic", agency: "Bureau of Fire Protection", tag: "Safety", priority: 1, when: "Every year, before the business permit renewal",
    title: "Renew the Fire Safety Inspection Certificate (FSIC)",
    summary: "The Fire Code (RA 9514) and its Revised IRR require a valid FSIC for the building. BFP inspects fire alarms, sprinklers, extinguishers, exit signs, fire doors and the fire pump.",
    action: "Book the BFP inspection early in the year. Before it, close every open fire-safety ticket from guard rounds and test the fire pump.",
    source: "RA 9514, Fire Code of the Philippines", url: "https://bfp.gov.ph",
  },
  {
    key: "sec-gis", agency: "Securities and Exchange Commission", tag: "Governance", priority: 1, when: "Yearly; GIS within 30 days of the annual meeting, AFS on the SEC filing calendar",
    title: "File the General Information Sheet and audited financial statements",
    summary: "A condominium corporation is a non-stock corporation under the Revised Corporation Code (RA 11232). It must file its GIS after each annual members' meeting and its audited financial statements on the schedule SEC publishes each year. Late filing means fines.",
    action: "Set the annual meeting date now and line up the external auditor. Building Mgt AI exports the year's books for the auditor.",
    source: "RA 11232, Revised Corporation Code; SEC filing calendar", url: "https://www.sec.gov.ph",
  },
  {
    key: "dues-tax", agency: "Supreme Court / BIR", tag: "Tax", priority: 2,
    title: "Association dues are not subject to income tax or VAT",
    summary: "In First E-Bank Tower Condominium Corp. v. BIR (2021), the Supreme Court struck down BIR RMC 65-2012 and held that association dues, membership fees and similar assessments collected by a condominium corporation are not income and not subject to VAT. Income from renting out common areas, parking or amenities to outsiders is still taxable.",
    action: "Keep dues and income-earning activities (amenity rental to non-residents, telco antenna leases, parking fees) in separate ledgers so only the latter is taxed.",
    source: "Supreme Court decision, First E-Bank Tower Condominium Corp. v. BIR (2021)", url: "https://sc.judiciary.gov.ph",
  },
  {
    key: "eopt", agency: "Bureau of Internal Revenue", tag: "Tax", priority: 2,
    title: "Invoices replace official receipts (Ease of Paying Taxes Act)",
    summary: "RA 11976 made the sales invoice the main proof of sale for goods and services. If the corporation issues documents for taxable income (for example amenity rental), they must follow the invoicing rules.",
    action: "Check that the receipts printed for taxable income use the invoice format. Dues statements are not affected.",
    source: "RA 11976 and its implementing regulations", url: "https://www.bir.gov.ph",
  },
  {
    key: "osh", agency: "Department of Labor and Employment", tag: "Safety", priority: 2,
    title: "Occupational safety rules cover building staff and contractors",
    summary: "The OSH Law (RA 11058) and DOLE Department Order 198-18 require a safety program, a trained safety officer, PPE, and incident reporting. The association is responsible for its own staff and must make sure contractors follow the rules on site.",
    action: "Name a safety officer, keep contractor permits-to-work for roof, electrical and hot works, and log incidents in the app.",
    source: "RA 11058; DOLE DO 198-18", url: "https://oshc.dole.gov.ph",
  },
  {
    key: "dpa", agency: "National Privacy Commission", tag: "Privacy", priority: 2,
    title: "Resident data, CCTV and visitor logs fall under the Data Privacy Act",
    summary: "The association collects names, phone numbers, IDs, plate numbers and CCTV footage. RA 10173 requires a Data Protection Officer, a privacy notice, security measures and breach reporting within 72 hours. NPC Circular 2022-04 sets when registration with the NPC is required.",
    action: "Appoint the DPO, keep CCTV and visitor-log retention short (for example 30 to 90 days), and check whether NPC registration applies.",
    source: "RA 10173; NPC Circular 2022-04", url: "https://privacy.gov.ph",
  },
  {
    key: "elevator", agency: "Makati Office of the Building Official", tag: "Safety", priority: 2, when: "Every year",
    title: "Annual elevator inspection and certificate of operation",
    summary: "Elevators need a yearly inspection and a valid certificate of operation from the local building official under the National Building Code (PD 1096) and the Philippine Mechanical Engineering Code.",
    action: "Ask LiftCare for the inspection schedule and post the certificates inside each car.",
    source: "PD 1096, National Building Code", url: "https://www.makati.gov.ph",
  },
  {
    key: "water", agency: "Department of Health", tag: "Safety", priority: 3,
    title: "Water tank cleaning and potable water testing",
    summary: "The Code on Sanitation (PD 856) and its rules on drinking water expect building water reservoirs to be kept clean and the water tested for bacteria by an accredited lab.",
    action: "Schedule tank cleaning and a bacteriological test at least twice a year and post the results in the lobby.",
    source: "PD 856, Code on Sanitation of the Philippines", url: "https://doh.gov.ph",
  },
  {
    key: "rpt", agency: "Makati City Treasurer", tag: "Deadline", priority: 2, when: "Early in the year",
    title: "Pay common-area real property tax early for the discount",
    summary: "The Local Government Code (RA 7160) lets cities give a discount of up to 20% for paying real property tax in advance. Makati sets the actual discount and deadline each year.",
    action: "Budget the common-area RPT for January and pay before the city's advance-payment deadline.",
    source: "RA 7160, Local Government Code, Sec. 251", url: "https://www.makati.gov.ph",
  },
  {
    key: "condo-act", agency: "Congress / DHSUD", tag: "Governance", priority: 3,
    title: "The Condominium Act and the master deed set what the board may do",
    summary: "RA 4726 as amended by RA 7899 governs condominium corporations, common areas and assessments. Disputes between unit owners and the corporation go to DHSUD's adjudication arm (RA 11201).",
    action: "Check big decisions (special assessments, leasing common areas) against the master deed and by-laws before the vote.",
    source: "RA 4726, RA 7899, RA 11201", url: "https://dhsud.gov.ph",
  },
  {
    key: "meralco", agency: "Energy Regulatory Commission / Meralco", tag: "Utilities", priority: 3, when: "Every month",
    title: "Electricity rates change monthly",
    summary: "Meralco's rate moves every month with generation and transmission charges approved by the ERC. Common-area electricity is one of Skyland's biggest costs.",
    action: "Building Mgt AI compares the bill to kWh from the guard meter readings, so a rate change and a usage spike are never confused.",
    source: "ERC and Meralco monthly rate advisories", url: "https://company.meralco.com.ph",
  },
  {
    key: "pagasa", agency: "PAGASA / Makati DRRMO", tag: "Weather", priority: 1, when: "Typhoon season, roughly June to November",
    title: "Follow PAGASA wind signals and Makati DRRMO advisories",
    summary: "PAGASA raises Tropical Cyclone Wind Signals 1 to 5 by expected wind strength. Makati's DRRMO announces class and work suspensions and evacuation advice.",
    action: "When Signal 1 or higher covers Metro Manila, run the typhoon prep list in the app and send the resident advisory.",
    source: "PAGASA tropical cyclone bulletins", url: "https://www.pagasa.dost.gov.ph",
  },
];
