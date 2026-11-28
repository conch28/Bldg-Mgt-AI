/**
 * Template house rules for Skyland Plaza, written from common practice in well-run Metro Manila condominiums
 * and the laws in lib/legallibrary.ts. They are a starting point only: the board approves, edits or replaces
 * each rule on /rules, and the edited text (HouseRule table) wins over this file.
 *
 * Numbering is fixed (§7.1 etc.) because the app and the AI quote it. Keep rules short and specific.
 */

export const RULES_VERSION = "Template 2026-11-28";

export type RuleTemplate = {
  id: string; // hr-...
  section: string; // "7.1"
  chapter: string;
  title: string;
  text: string;
  topics: string[]; // lowercase search words, English and Tagalog
  basis?: string; // law or reason behind it, for the board
};

export const CHAPTERS = [
  "1. General", "2. Noise and quiet hours", "3. Guests and passes", "4. Parking", "5. Pets", "6. Renovation and works",
  "7. Dues and charges", "8. Moving in and out", "9. Amenities", "10. Leasing and short stays", "11. Garbage and cleanliness",
  "12. Safety and security", "13. Deliveries", "14. Violations and fines",
] as const;

const R = (section: string, title: string, text: string, topics: string[], basis?: string): RuleTemplate => {
  const ch = CHAPTERS.find((c) => c.startsWith(section.split(".")[0] + "."))!;
  return { id: "hr-" + section.replace(".", "-"), section, chapter: ch, title, text, topics, basis };
};

export const RULE_TEMPLATES: RuleTemplate[] = [
  R("1.1", "Who these rules cover", "These rules apply to every owner, tenant, household member, guest, helper, contractor and short-stay guest. The unit owner is responsible for the conduct of everyone they let into the building and for any damage they cause.", ["who", "tenant", "guest", "responsible", "liable", "owner responsible"], "Master deed and declaration of restrictions (RA 4726 Sec. 9); Civil Code Art. 2180"),
  R("1.2", "Common areas", "Lobbies, corridors, stairs, elevators and the roof deck are for passage, not storage. Keep shoes, bikes, boxes and plants out of corridors and fire exits. Changes to the façade, corridor or balcony look (grilles, awnings, paint, signage) need board approval in writing.", ["common area", "corridor", "hallway", "storage", "facade", "balcony", "grille", "awning", "signage", "shoes", "bike"], "RA 4726 Sec. 6; Fire Code (no obstructed exits)"),
  R("1.3", "Rule changes", "The board may amend these rules by resolution. Owners get at least 15 days' notice of a change, except for urgent safety rules. The current rules are always on the app.", ["amend rules", "change rules", "new rule", "board resolution"], "By-laws; RA 4726 Sec. 9"),

  R("2.1", "Quiet hours", "Quiet hours are 10 PM to 7 AM every day. Keep music, TV, karaoke and voices at a level that can't be heard in the next unit or the corridor. Videoke and parties inside units end by 10 PM.", ["noise", "ingay", "quiet hours", "loud", "music", "karaoke", "videoke", "party", "maingay"], "Civil Code Art. 694 (nuisance); Makati noise ordinance"),
  R("2.2", "Noise complaints", "Report noise to the guard house (local 100) or in the app. The guard visits and asks politely first. Repeated complaints get a written warning and then a fine under §14. Neighbour disputes that don't settle go to barangay conciliation.", ["noise complaint", "reklamo", "neighbor", "kapitbahay", "barangay"], "RA 7160 (Katarungang Pambarangay)"),

  R("3.1", "Registering guests", "All guests sign in at the lobby with a valid ID, or come with a guest pass from the app. The guard calls the unit before letting in anyone without a pass.", ["guest", "bisita", "visitor", "guest pass", "id", "sign in", "register guest"]),
  R("3.2", "Overnight and long-stay guests", "Guests staying more than 3 nights are registered in the app. Guests staying more than 30 days are treated as occupants and registered like tenants (§10.1).", ["overnight", "stay", "sleep over", "long stay", "occupant", "relative"]),
  R("3.3", "Helpers, drivers and workers", "Household helpers and drivers are registered with a photo and ID. Contractors and delivery workers need a contractor pass from the owner and may use the service elevator only.", ["helper", "yaya", "kasambahay", "driver", "worker", "contractor", "service elevator"], "RA 10361 (Batas Kasambahay)"),

  R("4.1", "Assigned slots", "Park only in your assigned or leased slot, one vehicle per slot, inside the lines. Register every vehicle in the app (plate, make, colour) to get a sticker.", ["parking", "slot", "park", "sticker", "vehicle", "car", "sasakyan", "register car"]),
  R("4.2", "Guest parking", "Visitor parking is limited and first come, first served. Owners request a guest parking pass in the app with the plate number. Guest parking is free for up to 12 hours; overnight guest parking needs a pass for each night.", ["guest parking", "visitor parking", "parking pass", "bisita parking", "plate"]),
  R("4.3", "Driving and safety", "Maximum speed in the basement is 10 kph. No car washing, repairs (except emergencies), storage or sleeping in vehicles. Vehicles leaking oil must be fixed within 7 days.", ["speed", "car wash", "repair car", "oil leak", "basement"]),
  R("4.4", "Wrong parking", "A vehicle in someone else's slot, a fire lane or a driveway gets a notice. If it isn't moved within 2 hours after the owner is called, it may be clamped or towed at the vehicle owner's cost.", ["wrong parking", "towing", "tow", "clamp", "blocked", "occupied my slot"]),

  R("5.1", "Allowed pets", "Up to 2 small household pets (dogs or cats under 15 kg) per unit, plus fish and caged birds. Exotic or dangerous animals are not allowed.", ["pet", "pets", "dog", "aso", "cat", "pusa", "animal", "allowed pets"], "Declaration of restrictions"),
  R("5.2", "Registration and vaccines", "Register every dog and cat in the app with a current anti-rabies vaccination record, renewed yearly.", ["pet registration", "vaccine", "anti-rabies", "bakuna", "register pet"], "RA 9482 (Anti-Rabies Act)"),
  R("5.3", "Pets in common areas", "Pets are carried or leashed in common areas and use the service elevator only. Owners clean up after their pets right away. Pets aren't allowed in the pool, gym, function room or children's play area.", ["leash", "poop", "dumi", "service elevator", "pet in lobby", "pool pet"]),
  R("5.4", "Barking and nuisance", "A pet that barks for long periods, bites or keeps being a nuisance is handled like a noise complaint (§2.2). After 3 written warnings, the board may require the pet to be removed.", ["barking", "tahol", "bite", "kagat", "nuisance pet"], "Civil Code Art. 2183 (owner liable for damage by animals)"),

  R("6.1", "Permit first", "Any work beyond painting and minor repairs needs a renovation permit from the admin office before it starts. Submit plans at least 5 working days ahead. Fee ₱1,500 and a refundable bond of ₱10,000.", ["renovation", "permit", "construction", "repair unit", "plans", "bond", "fee", "contractor"], "National Building Code (PD 1096)"),
  R("6.2", "Work hours", "Renovation work is allowed Monday to Saturday, 8 AM to 5 PM. Noisy work (drilling, hacking) is from 9 AM to 12 noon and 1 PM to 5 PM. No work on Sundays and public holidays.", ["work hours", "drilling", "hacking", "noisy work", "sunday work", "holiday work"]),
  R("6.3", "What can't be changed", "No changes to structural walls, columns, beams, slabs, plumbing stacks, fire sprinklers or the building façade. Electrical upgrades need a licensed electrician and the engineer's sign-off.", ["structural", "wall", "plumbing", "stack", "sprinkler", "electrical", "upgrade", "aircon", "window"], "RA 4726 Sec. 6(e); PD 1096; Fire Code"),
  R("6.4", "Debris and damage", "Contractors bag and remove their own debris the same day using the service elevator. Damage to common areas or neighbours' units is charged to the bond first.", ["debris", "trash construction", "damage", "bond deduction"]),

  R("7.1", "When dues are due", "Association dues and other charges are due on the last day of each month. Unpaid amounts get a 2% monthly penalty after 30 days.", ["dues", "due date", "penalty", "late", "interest", "bayad", "association dues", "monthly dues"], "RA 4726 Sec. 20; by-laws"),
  R("7.2", "How to pay", "Pay in the app (GCash, Maya, card) or by bank transfer, with your unit number as the reference. Ask for an official receipt for every payment.", ["pay", "payment", "gcash", "maya", "bank", "receipt", "official receipt"]),
  R("7.3", "Late accounts", "Accounts more than 60 days late lose amenity booking until settled. Accounts more than 90 days late get a demand letter, and the board may register a lien on the unit. Owners can always ask for a payment plan.", ["delinquent", "overdue", "lien", "demand letter", "payment plan", "suspension", "amenity suspension"], "RA 4726 Sec. 20"),
  R("7.4", "Disputing a charge", "If you think a charge is wrong, tell the admin office in writing within 30 days. Pay the part you don't dispute while it's checked. The office answers within 10 working days.", ["dispute", "wrong charge", "billing error", "overcharged", "mali ang bill"]),

  R("8.1", "Booking a move", "Book moves in the app at least 3 days ahead. Moves are Monday to Saturday, 8 AM to 5 PM, using the service elevator with padding. The guard checks the gate pass against the items.", ["move in", "move out", "lipat", "moving", "gate pass", "service elevator"]),
  R("8.2", "Clearance to move out", "Moving out needs clearance from the admin office that dues are paid. Tenants also need the owner's written OK.", ["clearance", "move out clearance", "tenant move out"]),

  R("9.1", "Booking amenities", "Book the function room, courts and grill area in the app. The pool and gym don't need booking unless they're full. Owners more than 60 days late can't book (§7.3).", ["amenity", "book", "reserve", "function room", "court", "grill", "pool", "gym"]),
  R("9.2", "Hours", "Pool 6 AM to 9 PM, closed Mondays for cleaning. Gym 5 AM to 11 PM. Function room by 4-hour block, ₱2,500, until 10 PM.", ["pool hours", "gym hours", "function room fee", "oras", "open"]),
  R("9.3", "Safety at the pool and gym", "Children under 12 need an adult with them at the pool and gym. Proper swimwear only. No glass, no food in the water, no diving. Use the gym's equipment at your own risk and wipe it down after.", ["children", "kids", "swimwear", "lifeguard", "diving", "gym equipment"]),
  R("9.4", "Guests at amenities", "Residents may bring up to 4 guests, who must be with them at all times. Damage is charged to the unit.", ["guest pool", "bring guest", "guest amenity"]),

  R("10.1", "Registering tenants", "Owners register tenants in the app before move-in, with a copy of the lease and each adult's ID. Tenants follow these rules; the owner stays responsible for dues.", ["tenant", "lease", "rent", "upa", "renter", "register tenant"], "Civil Code Art. 1654; RA 10173 (only data needed)"),
  R("10.2", "Short stays (Airbnb)", "Short stays need at least 2 nights, registered in the app at least a day before check-in, with the number of guests. Maximum 2 guests per studio and 4 per 1-bedroom. Unregistered stays: ₱5,000 fine; 3 violations suspend hosting for 6 months.", ["airbnb", "short stay", "short-term", "transient", "staycation", "bnb"]),

  R("11.1", "Segregation", "Separate biodegradable, recyclable and residual waste in the marked bags. Garbage chutes are for small, tied bags only, 6 AM to 10 PM.", ["garbage", "basura", "trash", "segregation", "recycle", "chute"], "RA 9003 (Ecological Solid Waste Management Act)"),
  R("11.2", "Bulky items", "Furniture, appliances and construction waste are not for the chute. Book a bulky item pick-up with the admin office.", ["bulky", "furniture", "appliance", "old ref", "mattress"]),

  R("12.1", "Smoking", "No smoking or vaping in any enclosed common area, elevator, corridor, lobby or the pool deck. Use the designated smoking area. Smoke drifting into neighbours' units is handled as a nuisance.", ["smoking", "yosi", "vape", "cigarette", "smoke"], "EO 26 (2017); RA 11900 (vapes)"),
  R("12.2", "Fire safety", "No LPG tanks or open-flame cooking on balconies. No storage of fuel or flammables. Don't block or prop open fire doors. Take part in the yearly fire drill.", ["fire", "lpg", "gas tank", "balcony cooking", "fire door", "fire drill", "flammable"], "RA 9514 (Fire Code)"),
  R("12.3", "Balcony safety", "Secure plants and items on balconies; nothing on ledges. Don't throw anything from windows or balconies. Bring loose items in when a typhoon signal is raised.", ["balcony", "plants", "throw", "typhoon", "falling objects"]),
  R("12.4", "CCTV and privacy", "CCTV covers common areas only, for security. Footage is shown to residents only for an incident, through the admin office, and kept for 30 days unless needed for a case.", ["cctv", "camera", "footage", "privacy", "video"], "RA 10173; NPC Advisory 2024-02"),

  R("13.1", "Deliveries", "Couriers leave parcels and food at the lobby. A courier goes up only with a delivery pass from the resident. Parcels unclaimed after 7 days are returned or logged as lost and found.", ["delivery", "parcel", "package", "lalamove", "grab", "food delivery", "courier", "padala"]),

  R("14.1", "Warning first", "A first violation gets a friendly reminder or a written warning, except safety violations, which are fined right away.", ["violation", "warning", "paalala", "reminder"]),
  R("14.2", "Fines", "Unless a rule sets another amount: ₱1,000 for a second violation, ₱2,000 for a third and ₱5,000 for each one after that within 12 months. Fines are added to the unit's statement.", ["fine", "multa", "penalty", "charge", "violation fee"]),
  R("14.3", "Right to be heard", "Before a fine, the owner gets a written notice and 7 days to explain. The owner may appeal a fine to the board within 15 days; the board decides at its next meeting.", ["appeal", "contest", "explain", "due process", "hearing", "unfair fine"], "Due process; by-laws"),
];

export const ruleById = (id: string) => RULE_TEMPLATES.find((r) => r.id === id);
