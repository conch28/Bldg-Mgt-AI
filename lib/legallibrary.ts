/**
 * Legal library: Philippine laws, court rulings, tax rulings and regulator issuances that answer the questions
 * condo residents and boards ask. This file is the source of truth; prisma/legal-sync.ts copies it into the
 * LegalSource table on every deploy, and Ask AI searches that table (falling back to this file).
 *
 * verified = true means the citation and holding were checked against the source text or a reliable
 * summary on LIBRARY_REVIEWED. false means it is from general legal knowledge and should be checked by
 * counsel before anyone relies on it. Never add an entry you can't cite.
 */

export const LIBRARY_REVIEWED = "2026-11-28";

export type LegalKind = "Law" | "Court ruling" | "Tax" | "Privacy" | "Housing" | "Corporate" | "Safety & building" | "Labor" | "Local";
export type LegalEntry = {
  id: string;
  kind: LegalKind;
  citation: string; // how a lawyer would cite it
  title: string;
  agency: string;
  date?: string; // YYYY, YYYY-MM or YYYY-MM-DD
  topics: string[]; // lowercase search words, English and Tagalog
  summary: string; // what it says, precisely
  plain: string; // what it means for a resident or the board, in plain words
  who: "all" | "owner" | "board";
  url?: string;
  verified: boolean;
};

const LAWPHIL = "https://lawphil.net";

export const LIBRARY: LegalEntry[] = [
  /* ============================ Core condo law ============================ */
  {
    id: "ra4726", kind: "Law", citation: "Republic Act No. 4726 (The Condominium Act)", title: "The Condominium Act", agency: "Congress", date: "1966-06-18",
    topics: ["condominium act", "master deed", "declaration of restrictions", "common areas", "unit boundaries", "assessment", "lien", "foreclosure", "dues", "condominium corporation", "foreigner", "60/40"],
    summary: "Defines a condominium as a unit plus an undivided interest in common areas (Sec. 2-3). Requires a registered master deed (Sec. 4) and declaration of restrictions (Sec. 9). Sets default unit boundaries at the interior surfaces of perimeter walls, floors, ceilings, windows and doors and gives owners the exclusive right to refinish the interior (Sec. 6(a), 6(e)). Limits the condominium corporation to holding common areas and managing the project (Sec. 10). Makes assessments the owner's obligation and a lien once a notice is registered with the Register of Deeds, enforceable by judicial or extra-judicial foreclosure with a right of redemption (Sec. 20). Foreign ownership of common-area interests is capped at 40% (Sec. 5).",
    plain: "This is the main law for every condo. It says what you own, what is shared, that dues are a legal obligation, and how unpaid dues can become a lien on the unit.",
    who: "all", url: `${LAWPHIL}/statutes/repacts/ra1966/ra_4726_1966.html`, verified: true,
  },
  {
    id: "ra7899", kind: "Law", citation: "Republic Act No. 7899 (amending RA 4726, Sec. 4 and 16)", title: "Amendments on master deed changes and disposal of common areas", agency: "Congress", date: "1995",
    topics: ["amend master deed", "common area lease", "sell common area", "roof", "antenna", "telco", "majority of owners", "expansion"],
    summary: "The master deed may be amended or revoked by a simple majority of registered owners, with prior notice to all owners, and approval by the housing regulator or city/municipal engineer. The condominium corporation may not sell, exchange, lease or otherwise dispose of common areas without a simple majority of registered owners and prior notice to all.",
    plain: "Big changes, like amending the master deed or leasing the roof to a telco, need a majority of all registered owners, not just the board.",
    who: "board", url: `${LAWPHIL}/statutes/repacts/ra1995/ra_7899_1995.html`, verified: true,
  },
  {
    id: "ra4726-sec18", kind: "Law", citation: "RA 4726, Sec. 18", title: "Certificate from the management body needed to register a sale", agency: "Congress", date: "1966",
    topics: ["sell", "selling", "transfer", "clearance", "certificate", "register of deeds", "title", "buyer", "benta"],
    summary: "Conveyances of units are annotated on the title, and later conveyances are not registered unless accompanied by a certificate of the management body that the conveyance complies with the declaration of restrictions.",
    plain: "To transfer a unit, the buyer needs a clearance from the condo corporation. In practice it is issued once dues are paid.",
    who: "owner", url: `${LAWPHIL}/statutes/repacts/ra1966/ra_4726_1966.html`, verified: true,
  },
  {
    id: "pd957", kind: "Housing", citation: "Presidential Decree No. 957 (Subdivision and Condominium Buyers' Protective Decree)", title: "Buyers' protection against developers", agency: "Office of the President (now enforced by DHSUD)", date: "1976-07-12",
    topics: ["developer", "title", "turnover", "license to sell", "delivery of title", "amenities", "defect", "buyer", "pd 957"],
    summary: "Requires developers to register projects and hold a license to sell, to build the project and facilities as advertised and approved, and to deliver title to a buyer who has paid in full. Mortgaging a unit or lot without the regulator's approval is restricted. Violations carry administrative fines and criminal penalties.",
    plain: "If the developer hasn't delivered your title, finished the promised amenities, or built what was advertised, this law protects you. Complaints go to the housing regulator.",
    who: "all", url: `${LAWPHIL}/statutes/presdecs/pd1976/pd_957_1976.html`, verified: false,
  },
  {
    id: "ra11201", kind: "Housing", citation: "Republic Act No. 11201 (DHSUD Act)", title: "Creates DHSUD and the Human Settlements Adjudication Commission (HSAC)", agency: "Congress", date: "2019-02-14",
    topics: ["dhsud", "hsac", "hlurb", "housing", "developer complaint", "jurisdiction", "adjudication"],
    summary: "Reorganized the former HLURB: regulation went to the Department of Human Settlements and Urban Development (DHSUD), and adjudication of housing and real estate disputes went to the Human Settlements Adjudication Commission (HSAC).",
    plain: "Complaints against developers that used to go to HLURB now go to DHSUD (rules, permits) or HSAC (cases).",
    who: "all", url: "https://dhsud.gov.ph", verified: true,
  },
  {
    id: "ra6552", kind: "Housing", citation: "Republic Act No. 6552 (Maceda Law)", title: "Protection for buyers paying in installments", agency: "Congress", date: "1972-08-26",
    topics: ["installment", "hulugan", "refund", "cancel", "maceda", "grace period", "pre-selling", "buyer default"],
    summary: "For residential real estate bought on installment (condo units included): after at least two years of payments, the buyer gets a grace period of one month per year paid and, if the sale is cancelled, a refund of 50% of payments (plus 5% a year after five years, up to 90%). Below two years, the buyer gets at least a 60-day grace period. Cancellation requires a notarized notice and, where due, payment of the refund.",
    plain: "If you're still paying the developer in installments and fall behind, you have grace periods and possibly a refund. The developer can't just cancel.",
    who: "owner", url: `${LAWPHIL}/statutes/repacts/ra1972/ra_6552_1972.html`, verified: false,
  },

  /* ============================ Corporate and governance ============================ */
  {
    id: "ra11232", kind: "Corporate", citation: "Republic Act No. 11232 (Revised Corporation Code)", title: "Rules for the condominium corporation as a non-stock corporation", agency: "Congress / SEC", date: "2019-02-20",
    topics: ["agm", "annual meeting", "quorum", "proxy", "election", "trustee", "board", "removal", "minutes", "records", "inspect", "financial statements", "remote voting", "notice", "liability", "conflict of interest"],
    summary: "Members' meetings: regular meetings with written notice at least 21 days before (Sec. 49-50), quorum of a majority unless the by-laws say otherwise (Sec. 51), remote or in-absentia voting where allowed (Sec. 23, 57). Trustees of non-stock corporations serve terms set in the by-laws not exceeding three years (Sec. 91). Removal of a trustee needs two-thirds of the members entitled to vote at a meeting called for that purpose (Sec. 27). Trustees are personally liable for gross negligence, bad faith or unlawful acts (Sec. 30), and contracts with trustees or their relatives are voidable unless conditions are met (Sec. 31). Members may inspect records and are entitled to financial statements (Sec. 73-74).",
    plain: "This is the rulebook for AGMs, elections, the board's duties and your right to see the books.",
    who: "all", url: `${LAWPHIL}/statutes/repacts/ra2019/ra_11232_2019.html`, verified: false,
  },
  {
    id: "ra8799", kind: "Corporate", citation: "Republic Act No. 8799 (Securities Regulation Code), Sec. 5.2", title: "Intra-corporate disputes go to the RTC special commercial courts", agency: "Congress", date: "2000-07-19",
    topics: ["intra-corporate", "jurisdiction", "court", "election protest", "rtc", "commercial court", "sec", "case", "kaso"],
    summary: "Transferred jurisdiction over intra-corporate controversies (formerly with the SEC under PD 902-A) to Regional Trial Courts designated as special commercial courts.",
    plain: "Disputes between owners and the condo corporation about elections, voting, records or assessments go to a special commercial court, not the SEC.",
    who: "all", url: `${LAWPHIL}/statutes/repacts/ra2000/ra_8799_2000.html`, verified: true,
  },
  {
    id: "sec-gis-afs", kind: "Corporate", citation: "RA 11232, Sec. 177; SEC filing rules", title: "Annual GIS and audited financial statements", agency: "SEC", date: "2019",
    topics: ["sec", "gis", "general information sheet", "audited financial statements", "afs", "filing", "penalty", "auditor"],
    summary: "Corporations, including condominium corporations, file a General Information Sheet after the annual meeting and audited financial statements on the SEC's yearly schedule. Late or non-filing draws fines and can lead to delinquent status.",
    plain: "The board must file a GIS and audited financials with the SEC every year. Missing it means penalties.",
    who: "board", url: "https://www.sec.gov.ph", verified: false,
  },

  /* ============================ Court rulings ============================ */
  {
    id: "sc-first-ebank", kind: "Court ruling", citation: "BIR v. First E-Bank Tower Condominium Corp., G.R. Nos. 215801 and 218924 (2020)", title: "Condo dues are not income and not subject to VAT", agency: "Supreme Court", date: "2020",
    topics: ["vat", "income tax", "dues", "tax", "bir", "rmc 65-2012", "association dues", "buwis", "withholding"],
    summary: "The Supreme Court invalidated BIR RMC 65-2012, which had treated association dues, membership fees and other assessments of condominium corporations as taxable income and subject to VAT. Dues are collected and held in trust for the common areas, not income, and the corporation is not engaged in trade or business when it collects them.",
    plain: "Your monthly dues are not taxed. Only real income, like renting the roof, parking or amenities to outsiders, is.",
    who: "all", url: "https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/4/66002", verified: true,
  },
  {
    id: "sc-yamane-lepanto", kind: "Court ruling", citation: "Yamane v. BA Lepanto Condominium Corp., G.R. No. 154993, Oct. 25, 2005", title: "Cities can't charge local business tax on a condo corporation's dues", agency: "Supreme Court", date: "2005-10-25",
    topics: ["business tax", "local tax", "makati", "business permit", "lbt", "city hall", "dues", "tax"],
    summary: "The Supreme Court held that Makati could not impose local business tax on a condominium corporation because it is not engaged in business: its purposes under RA 4726 are limited to holding common areas and managing the project. A separate profit-making activity could be taxed.",
    plain: "The city can't tax your dues as business income. If the corporation runs a business on the side, that part can be taxed.",
    who: "board", url: "https://chanrobles.com/scdecisions/jurisprudence2005/oct2005/gr_154993_2005.php", verified: true,
  },
  {
    id: "sc-bnl-uy", kind: "Court ruling", citation: "BNL Management Corp. v. Uy, G.R. No. 210297 (2019)", title: "Utility disconnection for unpaid dues upheld where house rules allowed it", agency: "Supreme Court", date: "2019-04-03",
    topics: ["disconnect", "cut water", "cut electricity", "putol", "tubig", "kuryente", "delinquent", "unpaid dues", "house rules"],
    summary: "A condominium association disconnected water and electricity to units whose owner had not paid dues. The Supreme Court denied the owner's petition, finding the owner at fault for non-payment and the disconnection within the association's rights under its house rules and the Condominium Act.",
    plain: "Courts have upheld cutting utilities for unpaid dues when the building's rules clearly allow it and the owner was properly notified. It still depends on your building's documents, so the board should get legal advice before adopting such a policy.",
    who: "all", url: "https://jur.ph/jurisprudence/summary/bnl-management-corp-v-uy", verified: true,
  },
  {
    id: "sc-medical-plaza-cullen", kind: "Court ruling", citation: "Medical Plaza Makati Condominium Corp. v. Cullen, G.R. No. 181416, Nov. 11, 2013", title: "Owner's suit over assessments is intra-corporate (RTC commercial court)", agency: "Supreme Court", date: "2013-11-11",
    topics: ["jurisdiction", "dues dispute", "assessment", "intra-corporate", "court", "rtc", "voting rights", "complaint", "kaso"],
    summary: "A unit owner's suit challenging assessments and the corporation's acts affecting his rights as a member arises from the corporation-member relationship and is an intra-corporate controversy for the RTC acting as special commercial court.",
    plain: "If you sue the condo corporation over dues or your rights as a member, it goes to a special commercial court.",
    who: "all", url: "https://jur.ph/jurisprudence/summary/medical-plaza-makati-condominium-corp-v-cullen", verified: true,
  },
  {
    id: "sc-chateau-de-baie", kind: "Court ruling", citation: "Chateau de Baie Condominium Corp. v. Spouses Moreno, G.R. No. 186271", title: "Foreclosure for dues under Sec. 20, and dues disputes are intra-corporate", agency: "Supreme Court",
    topics: ["foreclosure", "remata", "lien", "dues computation", "intra-corporate", "rtc"],
    summary: "The association had foreclosed the owners' units for unpaid dues under RA 4726 Sec. 20. The owners' separate complaint over how dues were computed was an intra-corporate dispute within the RTC's jurisdiction, not the housing regulator's.",
    plain: "Unpaid dues can really lead to foreclosure. Disagreements about how dues were computed go to the commercial court.",
    who: "all", url: "https://jur.ph/jurisprudence/summary/chateau-de-baie-condominium-corp-v-spouses-moreno", verified: true,
  },
  {
    id: "sc-sunset-view", kind: "Court ruling", citation: "Sunset View Condominium Corp. v. Campos, Jr., G.R. Nos. 52361 and 52524 (1981)", title: "A buyer still paying in installments isn't yet a member", agency: "Supreme Court", date: "1981",
    topics: ["member", "stockholder", "installment buyer", "collection", "not fully paid", "jurisdiction"],
    summary: "A buyer of a unit on installment who has not fully paid and has no title is not yet the owner and so not a member of the condominium corporation. Collection of assessments from such a buyer is an ordinary civil case, not an intra-corporate one.",
    plain: "Until you've fully paid and the unit is yours, you may not be a voting member yet, and collection cases against you go to the regular courts.",
    who: "board", url: "https://jur.ph/jurisprudence/summary/sunset-view-condominium-corp-v-campos-jr", verified: true,
  },
  {
    id: "sc-cadungog-jung", kind: "Court ruling", citation: "Cadungog v. Jung, G.R. No. 254543, Apr. 2, 2025", title: "Buyer-developer contract claims belong to HSAC", agency: "Supreme Court", date: "2025-04-02",
    topics: ["developer", "title", "refund", "hsac", "hlurb", "pd 957", "jurisdiction", "buyer"],
    summary: "In a PD 957 case for failure to deliver title, the civil claim (delivery or refund) arose from contract and was under the exclusive jurisdiction of the HLURB, now HSAC. The criminal aspect stays with the regular courts.",
    plain: "If your fight is with the developer over the sale contract or title, file with HSAC, not the regular courts.",
    who: "all", url: "https://accralaw.com/2025/09/24/civil-liability-in-condominium-disputes-the-supreme-court-clarifies-the-hsacs-jurisdiction/", verified: true,
  },

  /* ============================ Tax ============================ */
  {
    id: "train-dues-vat", kind: "Tax", citation: "RA 10963 (TRAIN Law), NIRC Sec. 109(1)", title: "Association dues listed as VAT-exempt", agency: "Congress / BIR", date: "2018-01-01",
    topics: ["vat", "exempt", "train", "dues", "association dues", "tax"],
    summary: "The TRAIN Law added to the list of VAT-exempt transactions the association dues, membership fees and other assessments collected on a purely reimbursement basis by condominium corporations.",
    plain: "Even before the 2020 Supreme Court ruling, the Tax Code itself was amended to exempt dues from VAT.",
    who: "board", url: "https://www.bir.gov.ph", verified: true,
  },
  {
    id: "bir-rmc-65-2012", kind: "Tax", citation: "BIR RMC No. 65-2012 (invalidated)", title: "Old BIR circular taxing dues, struck down", agency: "BIR", date: "2012-10-31",
    topics: ["rmc 65-2012", "bir", "vat", "dues", "invalid", "tax"],
    summary: "Had declared association dues, membership fees and other assessments of condominium corporations subject to income tax, VAT and withholding. Declared invalid by the Supreme Court in BIR v. First E-Bank Tower (2020).",
    plain: "If anyone cites this circular to tax your dues, it's no longer valid.",
    who: "board", verified: true,
  },
  {
    id: "bir-taxable-income", kind: "Tax", citation: "NIRC Sec. 27-28 as applied in First E-Bank Tower (2020)", title: "What a condo corporation still pays tax on", agency: "BIR", date: "2020",
    topics: ["taxable", "income", "parking", "rental", "telco", "antenna", "amenity rental", "function room", "outsiders", "interest income"],
    summary: "Income from activities beyond collecting dues, such as leasing common areas or parking to non-members, telco antenna leases, advertising, and amenity fees from outsiders, is taxable income (and may be subject to VAT if above the threshold). Bank interest is subject to final tax.",
    plain: "Keep dues and income-earning activities in separate books. Only the income side is taxed.",
    who: "board", verified: false,
  },
  {
    id: "bir-ewt-contractors", kind: "Tax", citation: "RR 2-98 as amended; RMC 39-2007; BIR rulings 2010-2023", title: "Withholding tax on security, janitorial and manpower contractors", agency: "BIR", date: "2024-05",
    topics: ["withholding", "ewt", "2%", "security agency", "janitorial", "manpower", "contractor", "bir 2307", "tax"],
    summary: "For security agencies, only the agency fee (not the guards' salary component) is subject to 2% expanded withholding tax under RMC 39-2007. For janitorial, messengerial and other manpower contractors, gross payments are subject to 2% EWT. The corporation must remit and issue BIR Form 2307.",
    plain: "When the condo pays the security agency or cleaning contractor, it withholds 2% and gives them a certificate. The base differs for security agencies.",
    who: "board", url: "https://www.philstar.com/business/2024/05/14/2354834/www.home.kpmg/ph", verified: true,
  },
  {
    id: "rpt-condo", kind: "Tax", citation: "RA 4726 Sec. 25; RA 7160 (Local Government Code) Sec. 232-283", title: "Real property tax on units and common areas", agency: "City treasurer and assessor", date: "1991",
    topics: ["real property tax", "rpt", "amilyar", "assessor", "common areas", "unit tax", "city hall"],
    summary: "Each unit is separately assessed for real property tax, and that tax is a lien only on that unit (RA 4726 Sec. 25). Owners pay RPT on their own units to the city. Unpaid RPT accrues interest and can lead to a tax sale; assessments can be appealed to the local board of assessment appeals.",
    plain: "You pay the amilyar on your own unit directly to Makati City Hall. It's separate from condo dues.",
    who: "owner", url: `${LAWPHIL}/statutes/repacts/ra1991/ra_7160_1991.html`, verified: false,
  },
  {
    id: "eopt", kind: "Tax", citation: "Republic Act No. 11976 (Ease of Paying Taxes Act)", title: "Invoices replace official receipts", agency: "BIR", date: "2024-01-22",
    topics: ["invoice", "official receipt", "or", "eopt", "receipt", "bir"],
    summary: "Sales invoices replaced official receipts as the primary evidence of sale of goods and services, with transition rules for existing receipts.",
    plain: "Payments to the condo are now evidenced by invoices instead of ORs.",
    who: "board", url: "https://www.bir.gov.ph", verified: false,
  },
  {
    id: "rental-income-tax", kind: "Tax", citation: "NIRC Sec. 24 and 116; BIR registration rules", title: "Tax on rental income from your unit", agency: "BIR", date: "2018",
    topics: ["rental income", "airbnb", "lease", "tenant", "tax", "register bir", "percentage tax", "short-term rental"],
    summary: "Individuals earning rent from a unit are engaged in business and must register with the BIR, issue invoices, and pay income tax on the rent, plus 3% percentage tax or VAT depending on gross receipts. Short-term rental income is treated the same way.",
    plain: "If you rent out your unit, long-term or Airbnb, register with the BIR and declare the income.",
    who: "owner", url: "https://www.bir.gov.ph", verified: false,
  },

  /* ============================ Leasing ============================ */
  {
    id: "rent-control", kind: "Housing", citation: "RA 9653 (Rent Control Act of 2009) as extended by NHSB Resolution No. 2024-01", title: "Rent control for units renting ₱10,000 a month or less", agency: "National Human Settlements Board / DHSUD", date: "2025-01-01",
    topics: ["rent control", "rent increase", "taas upa", "deposit", "advance", "tenant", "lease", "eviction", "landlord"],
    summary: "Residential units with monthly rent of ₱10,000 or less are covered from Jan. 1, 2025 to Dec. 31, 2026. Increases for the same tenant are capped at 2.3% for 2025 and 1% for 2026. RA 9653 limits covered leases to one month advance and two months deposit and lists the only grounds for ejectment.",
    plain: "Most Skyland units rent for more than ₱10,000, so rent control usually won't apply. If yours rents for less, the increase cap for 2026 is 1%.",
    who: "owner", url: "https://philpropertyexpert.com/public/NHSB_Resolution_2024-01_Rent-Control-2025-2026.pdf", verified: true,
  },
  {
    id: "civil-lease", kind: "Law", citation: "Civil Code Arts. 1642-1688", title: "Lease of things: duties of landlord and tenant", agency: "Congress", date: "1950",
    topics: ["lease", "landlord", "tenant", "repairs", "deposit", "upa", "contract", "sublease"],
    summary: "The landlord must deliver the unit fit for use and make necessary repairs; the tenant must pay rent, use the unit with diligence and return it as received, save normal wear. A tenant may sublease unless prohibited. Leases of real property beyond one year should be in writing.",
    plain: "Put your lease in writing and spell out who pays dues, utilities and repairs.",
    who: "owner", url: `${LAWPHIL}/statutes/repacts/ra1949/ra_386_1949.html`, verified: false,
  },
  {
    id: "ejectment", kind: "Law", citation: "Rules of Court, Rule 70 (Forcible entry and unlawful detainer)", title: "How a tenant is lawfully evicted", agency: "Supreme Court", date: "1997",
    topics: ["eviction", "palayasin", "tenant won't leave", "unlawful detainer", "demand to vacate", "ejectment"],
    summary: "A landlord evicts a non-paying or holdover tenant through an unlawful detainer case in the first-level court, filed within one year from the last demand to vacate, after barangay conciliation where required. Self-help, like changing locks or cutting utilities to force a tenant out, exposes the landlord to liability.",
    plain: "You can't lock out a tenant yourself. Send a written demand, go to the barangay, then file in court.",
    who: "owner", verified: false,
  },

  /* ============================ Privacy ============================ */
  {
    id: "ra10173", kind: "Privacy", citation: "Republic Act No. 10173 (Data Privacy Act of 2012)", title: "How the condo may collect, use and share personal data", agency: "National Privacy Commission", date: "2012-08-15",
    topics: ["privacy", "personal data", "consent", "dpo", "data subject", "access", "delete", "lobby list", "delinquent list", "id"],
    summary: "Personal data must be processed transparently, for a legitimate purpose, and proportionately (Sec. 11), on a lawful basis (Sec. 12-13). Data subjects have rights to be informed, to access, to correct, to object and to erasure (Sec. 16). Unauthorized disclosure is penalized.",
    plain: "The condo may only collect what it needs, must protect it, and must show you your data when you ask. Posting delinquent owners' names publicly is risky.",
    who: "all", url: "https://privacy.gov.ph/data-privacy-act/", verified: true,
  },
  {
    id: "npc-cctv-2024", kind: "Privacy", citation: "NPC Circular No. 2024-02 (Guidelines on the Use of CCTV Systems)", title: "CCTV rules: signs, retention, and requests for footage", agency: "National Privacy Commission", date: "2024-08-09",
    topics: ["cctv", "footage", "camera", "video", "police request", "signage", "retention"],
    summary: "CCTV notices must be readily visible. There is no fixed retention period, but footage may be kept only as long as necessary and the period must be in the CCTV policy. A data subject may view footage within 5 working days and get a copy within 15 working days (extendable by 15 for complex requests); denials must give reasons. Footage is preserved while a request is pending. Law enforcement needs a written request or court order.",
    plain: "If you're in the footage, you can ask to see it. Ask quickly, because it's only kept for a limited time. Police need a written request.",
    who: "all", url: "https://privacy.gov.ph/wp-content/uploads/2024/08/NPC-Circular-No.-2024-02-CCTV-Systems.pdf", verified: true,
  },
  {
    id: "npc-westparc", kind: "Privacy", citation: "NPC 18-004 and 18-005, CA and VP v. Westparc Condominium (Nov. 13, 2023)", title: "Condo fined for ignoring owners' requests for their own data", agency: "National Privacy Commission", date: "2023-11-13",
    topics: ["access request", "my data", "201 file", "privacy complaint", "damages"],
    summary: "Unit owners asked a condominium association to let them inspect their own files and records after it collected IDs, photos and title documents. The association didn't respond. The NPC found a violation of the right to access (DPA Sec. 16(c)) and awarded ₱15,000 nominal damages to each complainant.",
    plain: "The condo must answer when you ask for your own data. Ignoring you can cost it damages.",
    who: "all", url: "https://privacy.gov.ph/wp-content/uploads/2024/08/NPC-18-004-and-18-005-2023.11.13-CA-v-Westparc-Condominium-Decision.pdf", verified: true,
  },
  {
    id: "npc-registration", kind: "Privacy", citation: "NPC Circular No. 2022-04 (Registration of Personal Data Processing Systems)", title: "When the condo must register with the NPC and name a DPO", agency: "National Privacy Commission", date: "2022",
    topics: ["dpo", "data protection officer", "npc registration", "privacy", "compliance"],
    summary: "Personal information controllers that meet the thresholds (such as processing personal data of 1,000 or more individuals, or sensitive data) must register their data processing systems and Data Protection Officer with the NPC.",
    plain: "A condo with hundreds of residents should have a Data Protection Officer and be registered with the NPC.",
    who: "board", url: "https://privacy.gov.ph", verified: false,
  },

  /* ============================ Neighbours, safety and community ============================ */
  {
    id: "barangay", kind: "Local", citation: "RA 7160 (Local Government Code), Sec. 399-422 (Katarungang Pambarangay)", title: "Barangay conciliation before going to court", agency: "Barangay", date: "1991",
    topics: ["barangay", "lupon", "neighbour dispute", "kapitbahay", "away", "noise", "leak damage", "settlement", "certificate to file action"],
    summary: "Disputes between individuals living in the same city or municipality must first go through mediation and conciliation at the barangay before a court case can be filed, except for listed exceptions (for example, where a party is a corporation or the offense carries a heavy penalty). A certificate to file action is issued if settlement fails.",
    plain: "For a fight with a neighbour, the barangay hall is the first stop. Courts will usually require it.",
    who: "all", url: `${LAWPHIL}/statutes/repacts/ra1991/ra_7160_1991.html`, verified: false,
  },
  {
    id: "civil-nuisance", kind: "Law", citation: "Civil Code Arts. 694-707 (Nuisance) and Art. 2176 (Quasi-delict)", title: "Nuisance and damage caused by negligence", agency: "Congress", date: "1950",
    topics: ["nuisance", "noise", "smell", "leak", "damage", "negligence", "who pays", "ingay", "tulo"],
    summary: "A nuisance is anything that injures health, annoys the senses or hinders use of property; a private nuisance can be abated or sued on. Whoever causes damage to another by fault or negligence must pay for it (Art. 2176).",
    plain: "If your neighbour's leak or noise harms you, they can be made to fix it and pay for the damage.",
    who: "owner", url: `${LAWPHIL}/statutes/repacts/ra1949/ra_386_1949.html`, verified: false,
  },
  {
    id: "civil-1723", kind: "Law", citation: "Civil Code Art. 1723", title: "15-year liability for structural defects", agency: "Congress", date: "1950",
    topics: ["structural defect", "crack", "bitak", "collapse", "engineer", "contractor", "developer", "warranty"],
    summary: "The engineer or architect who designed and the contractor who built a building are liable for damages if it collapses within 15 years from completion because of defects in construction, plans or the ground.",
    plain: "Serious structural defects can be claimed against the builders for up to 15 years.",
    who: "board", url: `${LAWPHIL}/statutes/repacts/ra1949/ra_386_1949.html`, verified: false,
  },
  {
    id: "eo26", kind: "Safety & building", citation: "Executive Order No. 26 (2017)", title: "Smoke-free enclosed public places", agency: "Office of the President", date: "2017-05-16",
    topics: ["smoking", "yosi", "vape", "smoke", "lobby", "hallway", "elevator"],
    summary: "Prohibits smoking in enclosed public places and public conveyances, and outside designated smoking areas in open public places, with LGUs enforcing.",
    plain: "No smoking in lobbies, hallways, lifts and other enclosed common areas.",
    who: "all", verified: false,
  },
  {
    id: "anti-rabies", kind: "Law", citation: "RA 9482 (Anti-Rabies Act of 2007); RA 8485 as amended by RA 10631 (Animal Welfare Act)", title: "Pet owners' duties", agency: "Congress", date: "2007",
    topics: ["pet", "dog", "aso", "cat", "pusa", "rabies", "vaccination", "leash", "bite", "animal cruelty"],
    summary: "Dog owners must have their dogs registered and vaccinated against rabies, must not let them roam, and are liable for bites. Cruelty to animals is penalized. Whether pets are allowed in a condo is set by its master deed, declaration and house rules.",
    plain: "Vaccinate and register your pet, keep it leashed in common areas, and follow the building's pet rules.",
    who: "owner", verified: false,
  },
  {
    id: "safe-spaces", kind: "Law", citation: "RA 11313 (Safe Spaces Act); RA 9262 (Anti-VAWC Act)", title: "Harassment and abuse", agency: "Congress", date: "2019",
    topics: ["harassment", "bastos", "catcalling", "threat", "abuse", "violence", "protection order", "vawc"],
    summary: "The Safe Spaces Act penalizes gender-based sexual harassment in public spaces, online and at work. RA 9262 covers violence against women and their children and lets barangays issue protection orders.",
    plain: "Harassment and abuse are crimes. Report to the guards, the police, or the barangay for a protection order.",
    who: "all", verified: false,
  },

  /* ============================ Fire, building and operations ============================ */
  {
    id: "fire-code", kind: "Safety & building", citation: "RA 9514 (Fire Code of the Philippines) and its 2019 Revised IRR", title: "Fire Safety Inspection Certificate and building fire systems", agency: "Bureau of Fire Protection", date: "2008",
    topics: ["fire", "sunog", "fsic", "bfp", "sprinkler", "alarm", "fire exit", "fire drill", "extinguisher", "fire door"],
    summary: "Buildings need a valid Fire Safety Inspection Certificate, renewed yearly with the business permit, after BFP inspection of alarms, sprinklers, extinguishers, exits and fire doors. Blocking exits and disabling fire protection are violations with fines and possible closure.",
    plain: "Don't block fire exits or tamper with alarms. The board must keep the FSIC current every year.",
    who: "all", url: "https://bfp.gov.ph", verified: false,
  },
  {
    id: "building-code", kind: "Safety & building", citation: "PD 1096 (National Building Code) and its IRR", title: "Permits for renovation, and lift and equipment certificates", agency: "City Building Official / DPWH", date: "1977",
    topics: ["building permit", "renovation", "alteration", "structural", "elevator permit", "certificate of operation", "occupancy"],
    summary: "Construction, alteration and repairs beyond minor work need a building permit from the city building official. Elevators, escalators and other mechanical equipment need periodic inspection and a certificate of operation.",
    plain: "Major renovations need a city permit on top of the condo's own permit. The board must keep lift certificates current.",
    who: "all", url: "https://www.dpwh.gov.ph", verified: false,
  },
  {
    id: "solid-waste", kind: "Local", citation: "RA 9003 (Ecological Solid Waste Management Act) and Makati ordinances", title: "Garbage segregation", agency: "LGU / DENR", date: "2001",
    topics: ["garbage", "basura", "segregation", "recycling", "waste", "trash"],
    summary: "Waste must be segregated at source into biodegradable, recyclable, residual and special wastes. LGUs enforce with fines and may refuse to collect unsegregated waste.",
    plain: "Separate your trash. The building can be fined if it isn't segregated.",
    who: "all", verified: false,
  },

  /* ============================ Labor (building staff) ============================ */
  {
    id: "contracting", kind: "Labor", citation: "Labor Code Arts. 106-109; DOLE Department Order No. 174-17", title: "Hiring guards, cleaners and technicians through contractors", agency: "DOLE", date: "2017-03-16",
    topics: ["contractor", "agency", "security agency", "janitorial", "manpower", "endo", "labor-only contracting", "solidary liability", "wages"],
    summary: "Legitimate job contractors must be registered with DOLE and have substantial capital and control over their workers; labor-only contracting is prohibited. The principal (the condo corporation) is solidarily liable with the contractor for unpaid wages and benefits of the contractor's workers.",
    plain: "Only use DOLE-registered agencies, and check they pay the guards and cleaners properly. If they don't, the condo can be made to pay.",
    who: "board", url: "https://www.dole.gov.ph", verified: false,
  },
  {
    id: "ra11917", kind: "Labor", citation: "RA 11917 (Private Security Services Industry Act)", title: "Security agencies and guards", agency: "PNP Supervisory Office for Security and Investigation Agencies", date: "2022-07-30",
    topics: ["security guard", "guard", "security agency", "license", "sosia", "guard wages"],
    summary: "Regulates private security agencies and guards: agencies and guards must be licensed by the PNP, guards must receive at least the minimum wage and mandated benefits, and agencies must meet capitalization and training rules.",
    plain: "Hire only PNP-licensed security agencies, and check that guards are licensed and paid properly.",
    who: "board", url: "https://legacy.senate.gov.ph/republic_acts/ra%2011917.pdf", verified: false,
  },
  {
    id: "osh-law", kind: "Labor", citation: "RA 11058 (Occupational Safety and Health Standards Act) and DOLE DO 198-18", title: "Safety for building staff and contractors", agency: "DOLE", date: "2018-08-17",
    topics: ["safety", "osh", "safety officer", "ppe", "accident", "work at height", "contractor safety"],
    summary: "Employers and contractors must provide a safe workplace, PPE, safety training and a safety officer, and report accidents. Work at height, electrical and confined-space work need extra controls.",
    plain: "Contractors working in the building must follow safety rules. Accidents can make the employer and the building liable.",
    who: "board", url: "https://www.dole.gov.ph", verified: false,
  },
  {
    id: "staff-benefits", kind: "Labor", citation: "PD 851 (13th month pay); RA 11199 (SSS); RA 11223 (PhilHealth); RA 9679 (Pag-IBIG)", title: "Mandatory pay and benefits for directly hired staff", agency: "DOLE / SSS / PhilHealth / Pag-IBIG", date: "2019",
    topics: ["13th month", "sss", "philhealth", "pag-ibig", "benefits", "employee", "staff", "payroll"],
    summary: "Employers must pay 13th month pay by Dec. 24, and register and remit SSS, PhilHealth and Pag-IBIG contributions for each employee. Wages must at least meet the regional minimum wage set by the NCR wage board.",
    plain: "If the condo hires staff directly, it must pay 13th month pay and remit government contributions on time.",
    who: "board", verified: false,
  },
];

/* ---------------- Search ---------------- */

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s%-]/gu, " ").replace(/\s+/g, " ");

/** Scores entries by topic phrases (strong) and words in the title and summary (weak). */
export function searchLibrary(entries: LegalEntry[], q: string, limit = 6): LegalEntry[] {
  const t = " " + norm(q) + " ";
  const words = t.split(" ").filter((w) => w.length > 3);
  const scored = entries.map((e) => {
    let s = 0;
    for (const k of e.topics) if (t.includes(k.includes(" ") ? k : ` ${k} `) || (!k.includes(" ") && k.length > 4 && t.includes(` ${k}`))) s += 2 + k.split(" ").length;
    const hay = " " + norm(`${e.title} ${e.citation} ${e.summary}`) + " ";
    for (const w of words) if (hay.includes(` ${w}`)) s += 0.4;
    return { e, s };
  }).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s);
  if (!scored.length) return [];
  return scored.filter((x) => x.s >= scored[0].s * 0.35).slice(0, limit).map((x) => x.e);
}

export const libraryById = (id: string) => LIBRARY.find((e) => e.id === id);

/** Library entries as compact text for Claude's prompt. */
export const libraryForPrompt = (entries: LegalEntry[]) => entries.map((e) =>
  `[@${e.id}] ${e.citation}${e.date ? ` (${e.date})` : ""}${e.verified ? "" : " [unverified: from general legal knowledge]"}\n${e.summary}\nPlain: ${e.plain}`).join("\n\n");
