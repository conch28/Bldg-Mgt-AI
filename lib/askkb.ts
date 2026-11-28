/**
 * Ask AI knowledge base: what Philippine condo residents and boards ask most, with the rule that applies
 * and where it comes from. Written and checked by people, not generated live, because a wrong legal summary
 * is worse than none. Claude answers from these cards (and cites them); with no API key the app answers
 * straight from the best-matching card. Update REVIEWED when you edit, and check each source link first.
 *
 * Everything here is general information, not legal advice. Building documents (master deed, declaration
 * of restrictions, by-laws, house rules) can change the default rules, and they win where the law allows.
 */

export const KB_REVIEWED = "2026-11-28";

export type Escalate = "lawyer" | "manager" | "board" | "barangay" | "agency" | "emergency";
export type Source = { label: string; url?: string };
export type Card = {
  id: string;
  group: Group;
  who: "all" | "owner" | "board"; // who usually asks; everyone can still read every card
  q: string; // the question in plain words
  keys: string[]; // match words, English and Tagalog, lowercase
  answer: string; // 2-5 sentences
  steps: string[]; // what to do next
  sources: Source[];
  escalate?: Escalate;
  link?: { href: string; label: string }; // the app page that does the next step
};

export const GROUPS = ["Dues & money", "Repairs & renovation", "Neighbours & pets", "Renting & selling", "Rights & privacy", "Meetings & the board", "Disputes & legal"] as const;
export type Group = (typeof GROUPS)[number];

const RA4726 = { label: "RA 4726, The Condominium Act", url: "https://lawphil.net/statutes/repacts/ra1966/ra_4726_1966.html" };
const RCC = { label: "RA 11232, Revised Corporation Code", url: "https://lawphil.net/statutes/repacts/ra2019/ra_11232_2019.html" };
const DPA = { label: "RA 10173, Data Privacy Act", url: "https://privacy.gov.ph/data-privacy-act/" };
const CIVIL = { label: "Civil Code of the Philippines (RA 386)", url: "https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html" };
const DOCS = { label: "Skyland master deed, by-laws and house rules (Documents page)" };

export const CARDS: Card[] = [
  /* ---------------- Dues & money ---------------- */
  {
    id: "dues-must-pay", group: "Dues & money", who: "owner",
    q: "Do I still have to pay dues if I'm unhappy with the service?",
    keys: ["dues", "bayad", "ayaw magbayad", "withhold", "unhappy", "protest", "hindi magbabayad", "service is bad", "refuse to pay", "association dues"],
    answer: "Yes po. Dues come from the registered declaration of restrictions, and the Condominium Act makes each assessment an obligation of the owner at the time it is made. Not paying is not a recognised form of protest; it adds penalties and can lead to a lien on the unit. The better route is to pay (you can write \"paid under protest\" on your payment note) and raise the issue in writing so it is on record.",
    steps: ["Pay the amount due, noting \"under protest\" if you dispute part of it.", "Write to the property manager and the board saying what is wrong and what you want fixed.", "If it isn't resolved, bring it to the board meeting or the annual members' meeting."],
    sources: [{ ...RA4726, label: "RA 4726 Sec. 9 and Sec. 20 (assessments are the owner's obligation)" }, DOCS],
    escalate: "board", link: { href: "/my", label: "See my bills" },
  },
  {
    id: "dues-lien", group: "Dues & money", who: "all",
    q: "What happens if dues stay unpaid? Can the condo foreclose my unit?",
    keys: ["delinquent", "unpaid", "lien", "foreclose", "foreclosure", "utang", "late", "penalty", "multa", "interest", "collection", "remata", "overdue"],
    answer: "Unpaid assessments, plus the interest, penalties and legal costs the declaration of restrictions allows, become a lien on the unit once the condominium corporation registers a notice of assessment with the Register of Deeds. That lien ranks above liens registered after it, except real property tax. The corporation can then enforce it by judicial or extra-judicial foreclosure, and the owner keeps a right of redemption. At Skyland, a 2% monthly penalty applies after 30 days (House Rules §7.1) and amenity privileges can be suspended after 90 days (§7.3).",
    steps: ["Owners: talk to the admin office early. A payment plan is almost always possible before any lien.", "Board: send a written demand first, then register the notice of assessment, and only then consider foreclosure with a lawyer."],
    sources: [{ ...RA4726, label: "RA 4726 Sec. 20 (lien, notice with the Register of Deeds, foreclosure, redemption)" }, DOCS],
    escalate: "lawyer", link: { href: "/my", label: "See my bills" },
  },
  {
    id: "dues-utilities", group: "Dues & money", who: "all",
    q: "Can the condo cut my water or electricity for unpaid dues?",
    keys: ["cut", "disconnect", "putol", "putulan", "water", "tubig", "kuryente", "electric", "power", "shut off"],
    answer: "This is one of the most disputed collection steps in Philippine condos. Cutting a basic utility is risky for the corporation unless the master deed or by-laws clearly allow it and due notice is given, and owners have challenged it in court and before housing regulators. The safer, standard remedies are penalties, suspension of amenity privileges, demand letters, the Sec. 20 lien and a collection case.",
    steps: ["Owners: if you get a disconnection notice, ask in writing for the by-law provision it relies on, and talk to the admin office about a payment plan.", "Board: get a lawyer's written opinion before ever approving a disconnection policy."],
    sources: [{ ...RA4726, label: "RA 4726 Sec. 20 (the remedy the law gives: lien and foreclosure)" }, DOCS],
    escalate: "lawyer",
  },
  {
    id: "dues-tax", group: "Dues & money", who: "board",
    q: "Are association dues subject to VAT or income tax?",
    keys: ["vat", "tax", "buwis", "bir", "income tax", "rmc 65-2012", "withholding"],
    answer: "No. In First E-Bank Tower Condominium Corp. v. BIR (2021), the Supreme Court struck down BIR RMC 65-2012 and held that association dues, membership fees and similar assessments collected by a condominium corporation are not income and are not subject to VAT. Income from renting common areas, parking or amenities to outsiders, or from a telco antenna lease, is still taxable.",
    steps: ["Keep dues and income-earning activities in separate ledgers.", "Ask the external auditor to confirm the tax treatment each year."],
    sources: [{ label: "Supreme Court, First E-Bank Tower Condominium Corp. v. BIR (2021)", url: "https://sc.judiciary.gov.ph" }],
    link: { href: "/reports", label: "Reports & finances" },
  },
  {
    id: "dues-increase", group: "Dues & money", who: "all",
    q: "Who decides dues increases and special assessments?",
    keys: ["increase", "itaas", "special assessment", "budget", "raise dues", "tumaas", "assessment", "sinking fund", "reserve"],
    answer: "The by-laws decide. Usually the board sets monthly dues from a budget it approves, while special assessments for big projects often need a members' vote; the declaration of restrictions may also set rules on assessments. Owners have a right to see the budget and the books behind any increase.",
    steps: ["Ask the admin office for the approved budget and the board resolution behind the increase.", "If you disagree, put it on the agenda of the next members' meeting.", "Board: publish the budget and the reason early. Residents accept increases they understand."],
    sources: [{ ...RA4726, label: "RA 4726 Sec. 9(d) (assessments in the declaration of restrictions)" }, { ...RCC, label: "RA 11232 Sec. 73-74 (books, records and financial statements)" }, DOCS],
    escalate: "board", link: { href: "/reports", label: "Reports & finances" },
  },
  {
    id: "reserve-fund", group: "Dues & money", who: "board",
    q: "Do we need a reserve fund, and how big?",
    keys: ["reserve fund", "sinking", "capex", "replacement", "pondo", "savings fund", "contingency"],
    answer: "Philippine law doesn't set a minimum reserve for condominium corporations, but lifts, pumps, roofing, generators and repainting all come due eventually, and without a reserve they become a surprise special assessment. A common practice is to set aside a fixed share of dues each month into a separate account, sized from a 10-15 year replacement plan.",
    steps: ["List major equipment with its age and expected life.", "Price each replacement and spread it over the years left.", "Approve the reserve contribution in the annual budget and report the balance at each AGM."],
    sources: [DOCS, { label: "Building Mgt AI equipment and maintenance records" }],
    link: { href: "/equipment", label: "Lifts & generator health" },
  },

  /* ---------------- Repairs & renovation ---------------- */
  {
    id: "what-i-own", group: "Repairs & renovation", who: "all",
    q: "What exactly do I own, and what is common area?",
    keys: ["own", "boundary", "boundaries", "common area", "akin", "pag-aari", "walls", "ceiling", "pipes", "facade", "balcony", "corridor"],
    answer: "Unless the master deed says otherwise, your unit runs to the interior surfaces of its perimeter walls, floors, ceilings, windows and doors. Everything else, such as structural walls, slabs, the facade, corridors, lifts and shared pipes, is common area held by the condominium corporation, and you own an undivided interest in it through your membership. The master deed has the exact definitions for Skyland.",
    steps: ["Check the master deed on the Documents page for your building's definitions.", "When in doubt, ask the admin office before changing anything outside your interior surfaces."],
    sources: [{ ...RA4726, label: "RA 4726 Sec. 3 and Sec. 6(a) (unit boundaries)" }, { ...RA4726, label: "RA 4726 Sec. 5 and Sec. 10 (common areas, membership)" }, DOCS],
    link: { href: "/documents", label: "Documents" },
  },
  {
    id: "leak-neighbor", group: "Repairs & renovation", who: "owner",
    q: "Water is leaking from the unit above. Who pays for the damage?",
    keys: ["leak", "tulo", "tumutulo", "water damage", "ceiling", "upstairs", "itaas", "kapitbahay", "seepage", "baha", "pipe", "who pays"],
    answer: "It depends on where the water comes from. If the source is inside the upper unit (a pipe, toilet or fixture serving only that unit), that owner is usually responsible for the repair and for damage caused by their negligence under the Civil Code. If it's a common stack, the roof or the facade, it's the condominium corporation's job. The engineering team's inspection report is what settles the source, so get one in writing.",
    steps: ["Report it now so an engineer inspects both units and writes down the source.", "Take photos and keep receipts for any damage.", "Share the report with the other owner. Most cases settle once the source is clear; if not, barangay conciliation comes before court."],
    sources: [{ ...RA4726, label: "RA 4726 Sec. 6(a) (what's inside the unit vs common area)" }, { ...CIVIL, label: "Civil Code Art. 2176 (damage caused by fault or negligence)" }, DOCS],
    escalate: "manager", link: { href: "/report", label: "Report a problem" },
  },
  {
    id: "renovation", group: "Repairs & renovation", who: "owner",
    q: "Can I renovate my unit? What needs a permit?",
    keys: ["renovate", "renovation", "remodel", "kitchen", "contractor", "permit", "tile", "paint", "pintura", "gawa", "aircon install", "wall", "hack"],
    answer: "You have the exclusive right to paint, tile and refinish the inner surfaces of your unit. Anything that touches structural walls, plumbing stacks, the facade, fire systems or shared wiring needs the condo's approval, and bigger works may also need a building permit from the city under the National Building Code. At Skyland: permit required, Mon-Sat 8 AM-5 PM, ₱1,500 fee plus ₱10,000 refundable bond, plans submitted 5 working days ahead, and no changes to plumbing stacks or structural walls.",
    steps: ["Submit your plan and contractor details on the Moving & renovation page.", "Wait for the permit and the gate pass for your workers.", "Keep the work inside the approved hours to avoid neighbour complaints."],
    sources: [{ ...RA4726, label: "RA 4726 Sec. 6(e) (right to refinish the interior)" }, { label: "PD 1096, National Building Code", url: "https://www.dpwh.gov.ph" }, DOCS],
    link: { href: "/moving", label: "Moving & renovation" },
  },
  {
    id: "developer-defects", group: "Repairs & renovation", who: "board",
    q: "There are defects from the developer. What can we do?",
    keys: ["developer", "defect", "turnover", "structural", "crack", "bitak", "warranty", "title", "pd 957", "hidden defect"],
    answer: "Contract disputes between buyers and the developer, such as title delivery, unfinished amenities or turnover issues under PD 957, go to the Human Settlements Adjudication Commission (formerly HLURB adjudication), as the Supreme Court confirmed in Cadungog v. Jung (G.R. No. 254543, 2025). Separately, the Civil Code makes the engineer, architect and contractor liable for 15 years if a building collapses or is threatened by structural defects. Act early, because claims have deadlines.",
    steps: ["Document defects with photos, dates and an engineer's report.", "Send the developer a written demand.", "Talk to a lawyer about filing with HSAC if there's no fix."],
    sources: [{ label: "PD 957 (subdivision and condominium buyers' protection)" }, { label: "RA 11201 (DHSUD and HSAC)", url: "https://dhsud.gov.ph" }, { label: "Supreme Court, Cadungog v. Jung, G.R. No. 254543 (2025)" }, { ...CIVIL, label: "Civil Code Art. 1723 (15-year structural liability)" }],
    escalate: "lawyer",
  },
  {
    id: "insurance", group: "Repairs & renovation", who: "all",
    q: "Is my unit insured by the condo?",
    keys: ["insurance", "insured", "seguro", "fire insurance", "typhoon damage", "flood"],
    answer: "The condominium corporation usually insures the building and common areas as allowed by the declaration of restrictions. That policy generally does not cover your furniture, appliances, interior improvements or your liability to neighbours, so owners and tenants should carry their own contents and liability cover. Ask the admin office for the summary of the building policy.",
    steps: ["Ask for the building policy summary and its deductible.", "Get contents and personal liability cover for your unit."],
    sources: [{ ...RA4726, label: "RA 4726 Sec. 9(a)(2) (insurance in the declaration of restrictions)" }, DOCS],
  },

  /* ---------------- Neighbours & pets ---------------- */
  {
    id: "noise", group: "Neighbours & pets", who: "owner",
    q: "My neighbour is noisy or smokes. What can I do?",
    keys: ["noise", "ingay", "maingay", "party", "videoke", "karaoke", "smoke", "smoking", "yosi", "vape", "smell", "amoy", "neighbor", "neighbour", "kapitbahay", "away"],
    answer: "Start with the house rules: they set quiet hours and conduct rules, and the admin office can issue notices and, after a hearing, penalties. Smoking in enclosed common areas such as lobbies, hallways and lifts is banned nationwide under EO 26. If the problem continues, a nuisance can be raised under the Civil Code, but for neighbours living in the same city the law requires barangay conciliation before going to court.",
    steps: ["If you're comfortable, talk to your neighbour calmly first.", "Report it to the admin office with dates and times. Repeated reports build the record.", "If it continues, ask for a board hearing or file at the barangay hall."],
    sources: [DOCS, { label: "Executive Order No. 26 (2017), smoke-free environments" }, { ...CIVIL, label: "Civil Code Art. 694-707 (nuisance)" }, { label: "RA 7160 Local Government Code, Sec. 399-422 (Katarungang Pambarangay)" }],
    escalate: "manager", link: { href: "/chat", label: "Tell the helpdesk" },
  },
  {
    id: "pets", group: "Neighbours & pets", who: "owner",
    q: "Are pets allowed? What are the rules?",
    keys: ["pet", "pets", "dog", "aso", "cat", "pusa", "alaga", "leash", "rabies", "bark", "tahol", "poop"],
    answer: "There's no national law banning pets in condos. The master deed, declaration of restrictions and house rules decide, and many buildings allow small pets with registration, leashes and lift rules. National law requires dogs to be registered and vaccinated against rabies and not left to roam (Anti-Rabies Act), and bans cruelty to animals (Animal Welfare Act).",
    steps: ["Register your pet on the Pets & vehicles page with its vaccination card.", "Use a leash in common areas and clean up after your pet.", "Complaints about a pet go to the admin office first."],
    sources: [{ label: "RA 9482, Anti-Rabies Act of 2007" }, { label: "RA 8485 as amended by RA 10631, Animal Welfare Act" }, DOCS],
    link: { href: "/registrations", label: "Pets & vehicles" },
  },
  {
    id: "parking", group: "Neighbours & pets", who: "owner",
    q: "Someone keeps using my parking slot. Can I rent mine out?",
    keys: ["parking", "slot", "garage", "sasakyan", "car", "kotse", "park"],
    answer: "Whether a parking slot is a separate titled unit you own or a common area you're assigned depends on the master deed, and that decides what you can do with it. Titled slots can usually be leased or sold, subject to building rules (some limit use to residents). For someone using your slot, the admin office and guards enforce the house rules.",
    steps: ["Check your title or deed of sale for the slot.", "Report misuse to the front desk with the plate number.", "Register any tenant's car before they park."],
    sources: [{ ...RA4726, label: "RA 4726 Sec. 3-4 (units and common areas in the master deed)" }, DOCS],
    link: { href: "/registrations", label: "Pets & vehicles" },
  },

  /* ---------------- Renting & selling ---------------- */
  {
    id: "leasing", group: "Renting & selling", who: "owner",
    q: "I want to rent out my unit. What are my obligations?",
    keys: ["rent", "lease", "tenant", "upa", "paupahan", "umuupa", "nangungupahan", "deposit", "advance", "contract", "lessee", "rent control"],
    answer: "Owners can lease their units unless the master deed restricts it, but you stay responsible to the condo for dues and for your tenant following the house rules. The Civil Code governs the lease itself. The Rent Control Act only covers lower-rent residential units (in Metro Manila, roughly ₱10,000 a month and below, as extended by the housing authority); for covered units it limits deposits to one month advance and two months deposit and caps increases.",
    steps: ["Register your tenant with the admin office and give them the house rules.", "Use a written lease that says who pays dues, utilities and repairs.", "Declare the rental income for tax."],
    sources: [{ ...CIVIL, label: "Civil Code Art. 1642-1688 (lease)" }, { label: "RA 9653, Rent Control Act of 2009 (as extended)" }, DOCS],
    link: { href: "/property", label: "Rent out or sell" },
  },
  {
    id: "short-stay", group: "Renting & selling", who: "all",
    q: "Is Airbnb or short-term rental allowed?",
    keys: ["airbnb", "short term", "short-term", "staycation", "transient", "daily rent", "booking.com", "guests"],
    answer: "Short stays are a building decision: the master deed, declaration of restrictions or house rules can allow, limit or ban them, and many Metro Manila condos require guest registration, ID checks and a minimum stay. The owner remains liable for guests' conduct and for paying tax on the rental income, and the BIR has asked condominium corporations for information on short-term rental owners.",
    steps: ["Check Skyland's house rules on short stays before you list.", "Register every guest with a stay pass so the lobby knows them.", "Keep records of income for your tax filings."],
    sources: [DOCS, { label: "BIR rules on income from rentals" }],
    link: { href: "/passes", label: "Guest & stay passes" },
  },
  {
    id: "selling", group: "Renting & selling", who: "owner",
    q: "I'm selling my unit. What clearance do I need?",
    keys: ["sell", "selling", "benta", "ibenta", "buyer", "clearance", "transfer", "title", "deed of sale", "foreigner", "foreign"],
    answer: "To register the sale, the Register of Deeds needs a certificate from the condominium corporation that the sale follows the declaration of restrictions, so clear your dues first and get that certificate from the admin office. The common-area interest or corporation membership transfers with the unit. Foreigners may buy, but foreign ownership in the project's common areas can't exceed 40%.",
    steps: ["Ask the admin office for a statement and a certificate of no outstanding dues.", "Buyers: ask for that certificate before paying, because a registered lien follows the unit."],
    sources: [{ ...RA4726, label: "RA 4726 Sec. 18 (management body certificate for registration)" }, { ...RA4726, label: "RA 4726 Sec. 5 (transfer with common-area interest; 60/40 rule)" }],
    link: { href: "/property", label: "Rent out or sell" },
  },

  /* ---------------- Rights & privacy ---------------- */
  {
    id: "inspect-records", group: "Rights & privacy", who: "all",
    q: "Can I see the condo's books, contracts and board minutes?",
    keys: ["records", "books", "minutes", "financial statement", "audit", "transparency", "inspect", "contract", "kopya", "copy", "budget", "liquidation"],
    answer: "Yes. As a member of the condominium corporation, you can inspect its records, including minutes of meetings and financial records, at reasonable hours on business days by written request, and you're entitled to the latest financial statements. The corporation can refuse only for a legitimate reason, such as improper use of the information.",
    steps: ["Make a written request to the corporate secretary saying which records you want and why.", "Most reports are already on the Reports and Documents pages."],
    sources: [{ ...RCC, label: "RA 11232 Sec. 73 (right to inspect records) and Sec. 74 (financial statements)" }],
    link: { href: "/documents", label: "Documents" },
  },
  {
    id: "my-data", group: "Rights & privacy", who: "all",
    q: "What personal data can the condo collect, and can I see mine?",
    keys: ["privacy", "data", "id", "personal information", "201 file", "my file", "consent", "dpo", "npc"],
    answer: "The condo may collect what it actually needs to run the building (identity, contact details, unit, vehicles, guests), and must tell you why and keep it secure. You have the right to access the data it holds about you. In 2023 the National Privacy Commission ordered a condominium corporation to pay ₱15,000 to each of two owners for ignoring their requests to see their own files.",
    steps: ["Ask the Data Protection Officer in writing for a copy of your data.", "If it's ignored, you can complain to the National Privacy Commission."],
    sources: [{ ...DPA, label: "RA 10173 Sec. 11 (proportionality) and Sec. 16 (data subject rights)" }, { label: "NPC 18-004 and 18-005, CA v. Westparc Condominium (2023)", url: "https://privacy.gov.ph" }],
    escalate: "agency", link: { href: "/account", label: "My account" },
  },
  {
    id: "delinquent-list", group: "Rights & privacy", who: "board",
    q: "Can we post the list of delinquent owners in the lobby?",
    keys: ["post", "list", "shame", "lobby", "bulletin", "delinquent list", "names", "ipost", "publish"],
    answer: "It's risky. The Data Privacy Act requires processing to be proportionate to its purpose, and naming people on a public board goes beyond what collection needs, which invites privacy complaints. Private statements, demand letters and the Sec. 20 lien are the lawful tools; if the by-laws require a report to members, use unit-level totals in members-only channels.",
    steps: ["Send private statements and reminders instead.", "Report delinquency to the board and members as totals or by unit code in members-only materials.", "Get the Data Protection Officer's sign-off for any list."],
    sources: [{ ...DPA, label: "RA 10173 Sec. 11 (legitimate purpose, proportionality)" }, { ...RA4726, label: "RA 4726 Sec. 20 (lawful collection remedy)" }],
    escalate: "lawyer", link: { href: "/collections", label: "Dues & collections" },
  },
  {
    id: "cctv", group: "Rights & privacy", who: "all",
    q: "Can I get a copy of the CCTV footage?",
    keys: ["cctv", "footage", "video", "camera", "kamera", "nakaw", "theft", "stolen", "police", "incident"],
    answer: "CCTV footage is personal data of everyone in it, so the condo releases it only with a lawful basis: a police or court request in writing, or to you when you're in it and others can be protected (for example, by viewing only). For a theft or incident, report it to the admin office right away, because footage is kept only for a limited time.",
    steps: ["Report the incident with the date, time and place right away.", "Ask the admin office to preserve the footage.", "For a crime, file a police blotter; the police can request the footage formally."],
    sources: [{ ...DPA, label: "RA 10173 Sec. 12-13 (lawful processing) and Sec. 16 (access)" }],
    escalate: "manager", link: { href: "/chat", label: "Tell the helpdesk" },
  },

  /* ---------------- Meetings & the board ---------------- */
  {
    id: "agm", group: "Meetings & the board", who: "all",
    q: "How do the annual meeting, quorum and proxies work?",
    keys: ["agm", "annual meeting", "meeting", "quorum", "proxy", "proxies", "vote", "botohan", "election", "eleksyon", "notice", "remote", "online"],
    answer: "The condominium corporation is a non-stock corporation, so members (unit owners) meet at least once a year on the date in the by-laws. Written notice of a regular meeting must go out at least 21 days before it, a quorum is a majority of members unless the by-laws say otherwise, and members can vote by proxy and, if the by-laws or the board allow it, remotely or in absentia. After the meeting, the corporation files its General Information Sheet with the SEC.",
    steps: ["Check the meeting date and notice on the Board meetings & AGM page.", "Can't attend? Sign a proxy for someone you trust.", "Board: send the notice, agenda and proxy forms 21+ days ahead."],
    sources: [{ ...RCC, label: "RA 11232 Sec. 49-51 (meetings, notice, quorum), Sec. 57 (remote voting), Sec. 88 (members' voting and proxies)" }, DOCS],
    link: { href: "/meetings", label: "Board meetings & AGM" },
  },
  {
    id: "board-term", group: "Meetings & the board", who: "all",
    q: "How long do board members serve, and can one be removed?",
    keys: ["board", "trustee", "director", "term", "remove", "removal", "tanggal", "palitan", "resign", "president", "officer"],
    answer: "Trustees of a non-stock corporation serve the term in the by-laws, which can't exceed three years; many condos elect yearly. Members can remove a trustee, with or without cause, by a vote of at least two-thirds of the members entitled to vote at a meeting called for that purpose with proper notice (removal without cause can't be used to deprive minority members of representation).",
    steps: ["Read the by-laws on terms and vacancies.", "A removal needs a members' meeting called for that purpose with proper notice. Get a lawyer to check the process."],
    sources: [{ ...RCC, label: "RA 11232 Sec. 27 (removal) and Sec. 91 (trustees of non-stock corporations)" }, DOCS],
    escalate: "lawyer",
  },
  {
    id: "board-duties", group: "Meetings & the board", who: "board",
    q: "What are our duties as board members, and when are we personally liable?",
    keys: ["duty", "duties", "liable", "liability", "conflict of interest", "self-dealing", "fiduciary", "kickback", "related party", "kamag-anak"],
    answer: "Trustees must act in good faith and with care for the corporation. They become personally liable for damages if they knowingly approve unlawful acts, act with gross negligence or bad faith, or have conflicts of interest that harm the corporation. A contract with a trustee or a trustee's relative is voidable unless it's disclosed, fair, approved without that trustee's vote and meets the other legal conditions.",
    steps: ["Declare any relationship with a supplier before a vote and step out of it.", "Approve spending against three quotes and keep it on record.", "Keep minutes for every decision."],
    sources: [{ ...RCC, label: "RA 11232 Sec. 30 (liability) and Sec. 31 (dealings with the corporation)" }],
    escalate: "lawyer", link: { href: "/procurement", label: "Procurement & controls" },
  },
  {
    id: "common-area-lease", group: "Meetings & the board", who: "board",
    q: "Can the board lease out common areas, like the roof for a telco antenna?",
    keys: ["roof", "antenna", "telco", "lease common", "billboard", "rent out common", "kiosk", "common area income"],
    answer: "Not on its own. The Condominium Act bars the condominium corporation from selling, exchanging, leasing or otherwise disposing of common areas without the approval of a simple majority of the registered owners, with prior notice to all owners. Income from such a lease is also taxable, unlike dues.",
    steps: ["Get the proposal and terms in writing.", "Notify all owners and get majority approval, ideally at a members' meeting.", "Book the income in a separate ledger."],
    sources: [{ ...RA4726, label: "RA 4726 Sec. 16 as amended by RA 7899 (disposal of common areas)" }],
    escalate: "lawyer",
  },
  {
    id: "change-manager", group: "Meetings & the board", who: "board",
    q: "How do we change property managers safely?",
    keys: ["change manager", "property manager", "terminate", "termination", "non-renewal", "notice", "transition", "handover", "turnover", "palitan ang manager", "contract"],
    answer: "Read the current management contract first: its term, whether it renews automatically, the written notice period for non-renewal, early-termination penalties, and any clauses on hiring the outgoing manager's staff. The corporation owns its own records and funds, so the contract should require a full handover of books, files and vendor contracts, and keeping bills current avoids giving the outgoing manager a reason to hold documents.",
    steps: ["Diary the non-renewal notice deadline and serve notice in writing, on time, by board resolution.", "Plan a parallel run so collections and repairs don't skip a beat.", "List every record, account and contract to hand over, and get a lawyer to review the notice."],
    sources: [{ ...RCC, label: "RA 11232 Sec. 73 (the corporation's records)" }, { ...CIVIL, label: "Civil Code Art. 1159 (contracts have the force of law between the parties)" }],
    escalate: "lawyer", link: { href: "/documents", label: "Documents" },
  },

  /* ---------------- Disputes & legal ---------------- */
  {
    id: "where-to-file", group: "Disputes & legal", who: "all",
    q: "Where do we file a condo dispute?",
    keys: ["file", "case", "kaso", "kasuhan", "complaint", "sue", "court", "korte", "hsac", "dhsud", "hlurb", "sec", "jurisdiction", "barangay", "lawyer", "abogado", "legal"],
    answer: "It depends on the dispute. Personal disputes between neighbours in the same city start at the barangay. Fights about board elections, voting, membership or access to records are intra-corporate disputes heard by the Regional Trial Court acting as a special commercial court. Buyer-developer contract disputes go to the Human Settlements Adjudication Commission. Privacy complaints go to the National Privacy Commission, and crimes to the police or prosecutor. Some dues and master-deed disputes are argued before housing regulators, so a lawyer should confirm the forum before anything is filed.",
    steps: ["Write down what happened, the dates and what you want.", "Try the condo's own process first: admin office, then a board hearing.", "Talk to a lawyer before filing. The IBP chapter or a Public Attorney's Office can help if cost is a concern."],
    sources: [{ label: "RA 7160 Sec. 399-422 (barangay conciliation)" }, { label: "RA 8799 Sec. 5.2 (intra-corporate disputes to the RTC)" }, { label: "RA 11201 (HSAC)", url: "https://dhsud.gov.ph" }, { ...DPA, label: "RA 10173 (NPC complaints)" }],
    escalate: "lawyer",
  },
  {
    id: "hierarchy", group: "Disputes & legal", who: "all",
    q: "Which rules win: the law, master deed, by-laws or house rules?",
    keys: ["master deed", "by-laws", "bylaws", "house rules", "declaration of restrictions", "rules", "patakaran", "amend", "amendment", "valid", "which rule"],
    answer: "From top down: the law (Condominium Act, Revised Corporation Code, Civil Code), then the master deed, then the declaration of restrictions, then the by-laws, then the house rules the board adopts. A lower rule can't contradict a higher one. Amending the master deed needs a majority of registered owners with prior notice to all and approval from the housing regulator or city engineer, while the declaration of restrictions is amended as it provides (by default a majority in interest).",
    steps: ["Read the relevant section on the Documents page.", "If a house rule seems to conflict with the master deed, raise it with the board in writing."],
    sources: [{ ...RA4726, label: "RA 4726 Sec. 4 (master deed and its amendment) and Sec. 9 (declaration of restrictions)" }, DOCS],
    link: { href: "/documents", label: "Documents" },
  },
  {
    id: "harassment-safety", group: "Disputes & legal", who: "all",
    q: "I feel threatened or harassed in the building.",
    keys: ["threat", "threaten", "harass", "harassment", "bastos", "hinipuan", "violence", "sinaktan", "hit", "abuse", "stalk", "unsafe", "takot", "banta"],
    answer: "Your safety comes first po. If you're in danger now, call the guard house at local 100 or 911. Gender-based harassment in streets, public spaces and workplaces is punishable under the Safe Spaces Act, and threats and physical harm are crimes you can report to the police. The building team can also restrict a visitor's access and keep incident records and footage.",
    steps: ["In danger now: local 100 or 911, or press SOS.", "Report it to the admin office so they can preserve footage and act.", "File a police blotter. For abuse at home, the barangay can issue a protection order."],
    sources: [{ label: "RA 11313, Safe Spaces Act" }, { label: "RA 9262, Anti-Violence Against Women and Their Children Act" }],
    escalate: "emergency", link: { href: "/sos", label: "Emergency SOS" },
  },
];

/** Starter questions per role, shown as chips. */
export const STARTERS: Record<"owner" | "board", string[]> = {
  owner: ["Water is leaking from the unit above. Who pays?", "Do I have to pay dues if I'm unhappy?", "Can I rent out my unit on Airbnb?", "Maingay ang kapitbahay ko, ano pwede gawin?", "Can I see the condo's financial statements?", "Pwede ba ang aso sa unit?"],
  board: ["Can we post the delinquent owners list?", "How do we change property managers safely?", "Quorum and proxies for the AGM?", "Can we lease the roof to a telco?", "When are trustees personally liable?", "Are dues subject to VAT?"],
};

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s-]/gu, " ");

/** Ranks cards by keyword hits, preferring longer (more specific) phrases. Used by the fallback and to pick context. */
export function findCards(question: string, limit = 3): Card[] {
  const t = " " + norm(question).replace(/\s+/g, " ") + " ";
  const scored = CARDS.map((c) => {
    let s = 0;
    for (const k of c.keys) if (t.includes(k.includes(" ") ? k : ` ${k}`)) s += 1 + k.split(" ").length;
    for (const w of norm(c.q).split(/\s+/)) if (w.length > 4 && t.includes(` ${w}`)) s += 0.5;
    return { c, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  // Keep only cards that are close to the best match, so "related" stays relevant.
  return scored.filter((x) => x.s >= scored[0].s * 0.5).slice(0, limit).map((x) => x.c);
}

export const cardById = (id: string) => CARDS.find((c) => c.id === id);

/** Words that mean someone may be in danger right now. */
export const isUrgent = (q: string) => /\b(fire|sunog|smoke alarm|gas leak|amoy gas|trapped|na-trap|injur|sugat|dugo|blood|sinaktan|violence|threat|banta|suicide|kill myself|emergency)\b/i.test(q);

export const DISCLAIMER = "General information only, not legal advice. For your specific case, please consult a lawyer.";

export const ESCALATE_TEXT: Record<Escalate, string> = {
  lawyer: "This one needs a lawyer's view before anyone acts.",
  manager: "The property manager can act on this for you.",
  board: "This is a board decision. You can raise it with the board.",
  barangay: "If talking doesn't work, the barangay can mediate.",
  agency: "A government agency handles complaints about this.",
  emergency: "If anyone is in danger, call the guard house (local 100) or 911 now.",
};

/** The cards as compact text for Claude's system prompt. */
export function kbForPrompt(): string {
  return CARDS.map((c) => `[#${c.id}] (${c.group}) ${c.q}\n${c.answer}\nNext: ${c.steps.join(" / ")}\nSources: ${c.sources.map((s) => s.label).join("; ")}${c.escalate ? `\nEscalate: ${c.escalate}` : ""}`).join("\n\n");
}
