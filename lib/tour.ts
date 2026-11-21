// Content for the in-app tutorial: welcome cards per role, and spotlight tips per screen.
// Keep each card to one idea and two short sentences. People skim on a phone.

export type Card = { icon: string; t: string; b: string };
export type Step = { s: string; t: string; b: string };

const nav = (href: string) => `.tabbar a[href="${href}"], .side a[href="${href}"]`;
const more = `.tabbar button[aria-controls="more-sheet"]`;

const MANAGER: Card[] = [
  { icon: "☀️", t: "Start every day on Today", b: "One list of what needs you now: approvals, escalations and residents who may be unhappy. The AI sorts it by urgency." },
  { icon: "🏢", t: "The live building", b: "Every unit on the 3D towers. Tap one to see its tickets, dues, energy use and who lives there." },
  { icon: "🛠️", t: "Requests run themselves", b: "Residents report by app, Messenger or Viber. AI writes the ticket, picks the vendor and starts the timer. You step in only when it escalates." },
  { icon: "📣", t: "AI drafts, you approve", b: "Announcements, meeting minutes and replies are drafted for you. Nothing goes out to residents until you approve it." },
];

export const CARDS: Record<string, Card[]> = {
  OWNER: [
    { icon: "👋", t: "Welcome po to Skyland Plaza!", b: "Everything for your unit is in this app: dues, repairs, guests and building news. It takes about a minute to learn." },
    { icon: "💳", t: "Dues, without the lines", b: "See what you owe, pay, and keep your receipts in one place. Tap Bills anytime." },
    { icon: "📸", t: "Report a problem in seconds", b: "Take a photo and the AI fills in the details. You'll get updates until it's fixed." },
    { icon: "🎟️", t: "Guests, help and safety", b: "Send guests a QR pass by Messenger or Viber. Ask the helpdesk anything, 24/7. In an emergency, tap SOS." },
  ],
  BOARD: [
    { icon: "👋", t: "Welcome to the board view", b: "See how Skyland is run without chasing reports. Everything here updates live." },
    { icon: "💚", t: "Resident happiness first", b: "Scores from quick resident check-ins, what drives them, and who needs a follow-up call." },
    { icon: "🧾", t: "Every peso, visible", b: "Collections, spending and the monthly report. Purchases above the limit wait for your sign-off." },
    { icon: "🗳️", t: "Meetings on autopilot", b: "AI drafts the agenda and the minutes and tracks action items. AGM proxies and quorum are counted for you." },
  ],
  MANAGER,
  ADMIN: [
    ...MANAGER.slice(0, 3),
    { icon: "👥", t: "Users, data and privacy", b: "Add owners and tenants, import data from spreadsheets, and handle privacy requests under Records." },
  ],
  GUARD: [
    { icon: "👋", t: "Welcome to the front desk", b: "This is your guard station. The big buttons at the bottom are all you need." },
    { icon: "📷", t: "Check every guest", b: "Scan the guest's QR or type the 6-letter code. Make sure their face matches the photo on the pass." },
    { icon: "🚶", t: "Guard rounds", b: "Scan each checkpoint on your round. Note anything wrong, and add a photo if you can." },
    { icon: "🚨", t: "SOS comes first", b: "When a resident presses SOS, a red bar appears on every screen. Tap it and respond right away." },
  ],
};

export const TIPS: Record<string, Step[]> = {
  "/home": [
    { s: ".status-card", t: "Your dues at a glance", b: "How much is due and when. Tap Pay now to settle and get your receipt." },
    { s: 'a.act[href="/report"]', t: "Report a problem", b: "Snap a photo and the AI fills in the rest. You'll get updates until it's fixed." },
    { s: 'a.act[href="/passes"]', t: "Guest passes", b: "Make a QR pass and send it by Messenger or Viber. The guard scans it at the lobby." },
    { s: nav("/chat"), t: "Helpdesk, 24/7", b: "Ask anything po, in English or Taglish. Repairs become tickets on their own." },
    { s: `.mtop .sos-btn, ${nav("/sos")}`, t: "Emergency SOS", b: "For emergencies only. The guard and the manager are alerted right away." },
    { s: `${more}, .side .userbox`, t: "Everything else", b: "Voting, events, documents and typhoon updates are here, together with your account." },
  ],
  "/today": [
    { s: ".brief", t: "Morning briefing", b: "Your AI summary of what changed and what needs you today." },
    { s: ".twin", t: "Live building", b: "Tap a unit for its tickets, dues and energy. Switch the view with the tabs at the top." },
    { s: '[data-tour="list"]', t: "Your list", b: "Approvals, escalations and residents at risk, sorted by urgency. Clear it and you're done." },
    { s: nav("/work-orders"), t: "Requests", b: "Every work order with its timer. Escalated ones are counted on the badge." },
    { s: nav("/comms"), t: "Resident updates", b: "AI drafts announcements. Nothing is sent until you approve it." },
  ],
  "/board": [
    { s: ".twin", t: "Live building", b: "Tap any unit or floor. Switch views to see repairs, happiness, occupancy, dues and energy." },
    { s: nav("/happiness"), t: "Resident happiness", b: "Scores, what drives them, and who needs a follow-up." },
    { s: nav("/procurement"), t: "Spending", b: "Purchases waiting for your sign-off show a badge here." },
    { s: `${nav("/meetings")}, ${more}`, t: "Meetings & AGM", b: "AI-drafted agendas and minutes, action items and AGM proxies." },
  ],
  "/frontdesk": [
    { s: '[data-tour="check"]', t: "Check a guest", b: "Scan the QR or type the code. Match the guest's face with the photo on the pass, then check them in." },
    { s: '[data-tour="expected"]', t: "Expected visitors", b: "Everyone with a pass for today. Check them off as they arrive." },
    { s: nav("/rounds"), t: "Guard rounds", b: "Start your round here and scan each checkpoint." },
    { s: nav("/sos"), t: "SOS alerts", b: "Open emergencies. Respond to these first." },
  ],
};
