import Link from "next/link";
import Nav, { type NavItem, type Tab } from "@/components/Nav";
import Providers from "../providers";
import { requireRole, homeFor } from "@/lib/auth";
import { Suspense } from "react";
import Tour from "@/components/Tour";
import AskFab from "@/components/AskFab";
import { aiEnabled } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { demoMode } from "@/lib/env";
import { allTasks, tasksFor } from "@/lib/duties";
import { SITES, siteForEmail } from "@/lib/green";
import { BCDA_LOGIN, BCDA_NAME } from "@/lib/bcda";

type Item = NavItem & { roles: string[] };
const B = ["BOARD", "MANAGER", "ADMIN"], M = ["MANAGER", "ADMIN"], O = ["OWNER"], STAFF = ["MANAGER", "ADMIN", "GUARD"];
// Grouped list for the desktop sidebar and the phone "More" sheet. Keep groups short: people scan, they don't read.
const ALL: Item[] = [
  // Unit owner: four plain sections. The AI helper (top right) and Ask AI stay one tap away everywhere.
  { href: "/home", label: "Home", group: "Everyday", icon: "home", roles: O },
  { href: "/my", label: "Bills & dues", group: "Everyday", icon: "card", roles: O, kw: "pay balance utilities water electric soa gcash" },
  { href: "/report", label: "Report a problem", group: "Everyday", icon: "wrench", roles: O, kw: "repair leak broken aircon ticket photo" },
  { href: "/ask", label: "Ask AI", group: "Everyday", icon: "spark", roles: O, kw: "rules rights law help question" },
  { href: "/chat", label: "Helpdesk chat", group: "Everyday", icon: "chat", roles: O, kw: "message talk manager help" },
  { href: "/updates", label: "Building updates", group: "Everyday", icon: "mega", roles: O, kw: "news announcements notices" },
  { href: "/passes", label: "Guest & delivery passes", group: "My unit", icon: "pass", roles: O, kw: "visitor parking stay airbnb contractor" },
  { href: "/amenities", label: "Book an amenity", group: "My unit", icon: "cal", roles: O, kw: "pool gym function room reserve" },
  { href: "/services", label: "In-unit services", group: "My unit", icon: "bag", roles: O, kw: "aircon cleaning pest control" },
  { href: "/moving", label: "Moving & renovation", group: "My unit", icon: "box", roles: O, kw: "move in out permit" },
  { href: "/registrations", label: "Pets & vehicles", group: "My unit", icon: "paw", roles: O, kw: "car parking sticker dog cat" },
  { href: "/property", label: "Rent out or sell", group: "My unit", icon: "key", roles: O, kw: "lease tenant listing income broker" },
  { href: "/neighbors", label: "Neighbours & events", group: "Community", icon: "users", roles: O, kw: "party christmas" },
  { href: "/community", label: "Marketplace, lost & found", group: "Community", icon: "store", roles: O, kw: "buy sell" },
  { href: "/polls", label: "Voting", group: "Community", icon: "vote", roles: O, kw: "poll proxy agm election" },
  { href: "/rules", label: "House rules", group: "Rules & safety", icon: "doc", roles: O, kw: "penalty pets noise" },
  { href: "/documents", label: "Documents", group: "Rules & safety", icon: "folder", roles: O, kw: "master deed bylaws minutes" },
  { href: "/typhoon", label: "Typhoon & safety", group: "Rules & safety", icon: "storm", roles: O, kw: "flood storm emergency" },
  { href: "/sos", label: "Emergency SOS", group: "Rules & safety", icon: "alert", roles: O, kw: "help fire medical" },

  { href: "/today", label: "Today", group: "Run the building", icon: "check", roles: M },
  { href: "/tasks", label: "My tasks", group: "Run the building", icon: "vote", roles: STAFF },
  { href: "/tasks", label: "My tasks", group: "Board", icon: "vote", roles: ["BOARD"] },
  { href: "/frontdesk", label: "Front desk", group: "Run the building", icon: "shield", roles: STAFF },
  { href: "/rounds", label: "Guard rounds", group: "Run the building", icon: "route", roles: STAFF },
  { href: "/procurement", label: "Receive deliveries", group: "Run the building", icon: "cart", roles: ["GUARD"] },
  { href: "/sos", label: "SOS alerts", group: "Run the building", icon: "alert", roles: STAFF },
  { href: "/typhoon", label: "Typhoon mode", group: "Run the building", icon: "storm", roles: [...STAFF, "BOARD"] },
  { href: "/equipment", label: "Lifts & generator health", group: "Run the building", icon: "gear", roles: B },
  { href: "/energy", label: "Energy & water", group: "Run the building", icon: "bolt", roles: B },
  { href: "/channels", label: "Messenger & Viber", group: "Run the building", icon: "chat", roles: B },
  { href: "/work-orders", label: "Work orders", group: "Run the building", icon: "wrench", roles: B },
  { href: "/comms", label: "Resident updates", group: "Run the building", icon: "mega", roles: B },
  { href: "/collections", label: "Dues & collections", group: "Run the building", icon: "card", roles: B },
  { href: "/moving", label: "Moves & renovations", group: "Run the building", icon: "box", roles: STAFF },
  { href: "/registrations", label: "Pets & vehicles", group: "Run the building", icon: "paw", roles: STAFF },
  { href: "/community", label: "Lost & found, marketplace", group: "Run the building", icon: "store", roles: STAFF },
  { href: "/happiness", label: "Resident happiness", group: "Board", icon: "heart", roles: B },
  { href: "/board", label: "Building overview", group: "Board", icon: "pulse", roles: B },
  { href: "/reports", label: "Reports & finances", group: "Board", icon: "bars", roles: B },
  { href: "/ask", label: "Ask AI: law & procedure", group: "Board", icon: "spark", roles: B },
  { href: "/rules", label: "House rules (edit & approve)", group: "Board", icon: "doc", roles: B },
  { href: "/advisor", label: "AI advisor & weather", group: "Board", icon: "bulb", roles: B },
  { href: "/procurement", label: "Procurement & controls", group: "Board", icon: "cart", roles: B },
  { href: "/scorecard", label: "Manager scorecard", group: "Board", icon: "medal", roles: B },
  { href: "/duties", label: "Accountability", group: "Board", icon: "shield", roles: B },
  { href: "/integrity", label: "Staff data scores", group: "Board", icon: "medal", roles: B },
  { href: "/data", label: "Data Center", group: "Board", icon: "layers", roles: B },
  { href: "/listings", label: "Units for sale & lease", group: "Board", icon: "key", roles: B },
  { href: "/meetings", label: "Board meetings & AGM", group: "Board", icon: "cal", roles: B },
  { href: "/polls", label: "Voting & proxies", group: "Board", icon: "vote", roles: B },
  { href: "/neighbors", label: "Neighbours feed", group: "Board", icon: "users", roles: B },
  { href: "/maintenance", label: "Maintenance calendar", group: "Records", icon: "gear", roles: B },
  { href: "/amenities", label: "Amenity bookings", group: "Records", icon: "cal", roles: M },
  { href: "/inventory", label: "Stock & assets", group: "Records", icon: "layers", roles: B },
  { href: "/vendors", label: "Vendors & contracts", group: "Records", icon: "truck", roles: B },
  { href: "/documents", label: "Documents", group: "Records", icon: "folder", roles: B },
  { href: "/admin/users", label: "Users & units", group: "Records", icon: "users", roles: ["ADMIN"] },
  { href: "/admin/import", label: "Import data", group: "Records", icon: "doc", roles: ["ADMIN"] },
  { href: "/admin/system", label: "System & privacy", group: "Records", icon: "shield", roles: ["ADMIN"] },
  { href: "/investor", label: "Investor snapshot", group: "Overview", icon: "bars", roles: ["INVESTOR"] },
  { href: "/building-owner", label: "Owner overview", group: "Overview", icon: "pulse", roles: ["LANDLORD"] },
  { href: "/green", label: "Sustainability", group: "Overview", icon: "bolt", roles: ["CLIENT"] },
  { href: "/green", label: "Sustainability demos", group: "Demo views", icon: "bolt", roles: B },
  { href: "/green/clark", label: "Clark command center", group: "Overview", icon: "pulse", roles: ["CLIENT"] },
  { href: "/green/clark", label: "Clark command center", group: "Demo views", icon: "pulse", roles: B },
  { href: "/green/map", label: "3D city map", group: "Overview", icon: "box", roles: ["CLIENT"] },
  { href: "/green/map", label: "3D city map", group: "Demo views", icon: "box", roles: B },
  { href: "/green/bcda", label: "BCDA building (NGAC)", group: "Demo views", icon: "home", roles: B },
  { href: "/investor", label: "Investor view", group: "Demo views", icon: "bars", roles: ["ADMIN"] },
  { href: "/building-owner", label: "Building owner view", group: "Demo views", icon: "home", roles: ["ADMIN"] },
];
// Board president: what a board member actually does, in that order. Same pages as before, fewer places to look.
const BOARD_ITEMS: Item[] = [
  { href: "/board", label: "Building overview", group: "At a glance", icon: "pulse", roles: [], kw: "home dashboard today" },
  { href: "/happiness", label: "Resident happiness", group: "At a glance", icon: "heart", roles: [], kw: "pulse survey score" },
  { href: "/reports", label: "Reports & finances", group: "At a glance", icon: "bars", roles: [], kw: "budget income statement collections board report" },
  { href: "/ask", label: "Ask AI: law & procedure", group: "At a glance", icon: "spark", roles: [], kw: "rules rights legal ra 4726 help" },
  { href: "/advisor", label: "AI advisor & weather", group: "At a glance", icon: "bulb", roles: [], kw: "savings recommendations" },
  { href: "/tasks", label: "My tasks", group: "Decide & approve", icon: "check", roles: [], kw: "to do overdue" },
  { href: "/procurement", label: "Spending approvals", group: "Decide & approve", icon: "cart", roles: [], kw: "procurement purchase quotes sign red flags controls" },
  { href: "/meetings", label: "Board meetings & AGM", group: "Decide & approve", icon: "cal", roles: [], kw: "minutes agenda" },
  { href: "/polls", label: "Voting & proxies", group: "Decide & approve", icon: "vote", roles: [], kw: "poll election" },
  { href: "/rules", label: "House rules (edit & approve)", group: "Decide & approve", icon: "doc", roles: [], kw: "penalty policy" },
  { href: "/work-orders", label: "Repairs & work orders", group: "Building", icon: "wrench", roles: [], kw: "tickets requests" },
  { href: "/maintenance", label: "Maintenance calendar", group: "Building", icon: "gear", roles: [], kw: "preventive pm" },
  { href: "/equipment", label: "Lifts & generator health", group: "Building", icon: "gear", roles: [], kw: "elevator genset" },
  { href: "/energy", label: "Energy & water", group: "Building", icon: "bolt", roles: [], kw: "meralco power utilities" },
  { href: "/typhoon", label: "Typhoon mode", group: "Building", icon: "storm", roles: [], kw: "storm flood emergency" },
  { href: "/collections", label: "Dues & collections", group: "Residents", icon: "card", roles: [], kw: "overdue arrears payments" },
  { href: "/comms", label: "Resident updates", group: "Residents", icon: "mega", roles: [], kw: "announcements sms" },
  { href: "/channels", label: "Messenger & Viber", group: "Residents", icon: "chat", roles: [], kw: "facebook chat" },
  { href: "/neighbors", label: "Neighbours feed", group: "Residents", icon: "users", roles: [], kw: "events community" },
  { href: "/listings", label: "Units for sale & lease", group: "Residents", icon: "key", roles: [], kw: "rent broker" },
  { href: "/scorecard", label: "Manager scorecard", group: "Checks & records", icon: "medal", roles: [], kw: "kpi performance" },
  { href: "/duties", label: "Accountability", group: "Checks & records", icon: "shield", roles: [], kw: "duties who" },
  { href: "/integrity", label: "Staff data scores", group: "Checks & records", icon: "medal", roles: [], kw: "spot checks" },
  { href: "/data", label: "Data Center", group: "Checks & records", icon: "layers", roles: [], kw: "register readiness" },
  { href: "/vendors", label: "Vendors & contracts", group: "Checks & records", icon: "truck", roles: [], kw: "suppliers" },
  { href: "/inventory", label: "Stock & assets", group: "Checks & records", icon: "layers", roles: [], kw: "inventory qr" },
  { href: "/documents", label: "Documents", group: "Checks & records", icon: "folder", roles: [], kw: "master deed bylaws minutes permits" },
  { href: "/green", label: "Sustainability demos", group: "Demo views", icon: "bolt", roles: [], kw: "green ncc" },
  { href: "/green/clark", label: "Clark command center", group: "Demo views", icon: "pulse", roles: [] },
  { href: "/green/map", label: "3D city map", group: "Demo views", icon: "box", roles: [] },
  { href: "/green/bcda", label: "BCDA building (NGAC)", group: "Demo views", icon: "home", roles: [] },
];
const FOLD: Record<string, string[]> = { OWNER: ["Community", "Rules & safety"], BOARD: ["Building", "Residents", "Checks & records", "Demo views"] };
// Bottom tab bar on phones: four destinations per role plus "More".
const TABS: Record<string, Tab[]> = {
  OWNER: [{ href: "/home", label: "Home", icon: "home" }, { href: "/my", label: "Bills", icon: "card" }, { href: "/ask", label: "Ask AI", icon: "spark" }, { href: "/passes", label: "Passes", icon: "pass" }],
  BOARD: [{ href: "/board", label: "Overview", icon: "pulse" }, { href: "/happiness", label: "Happiness", icon: "heart" }, { href: "/procurement", label: "Approvals", icon: "cart" }, { href: "/ask", label: "Ask AI", icon: "spark" }],
  MANAGER: [{ href: "/today", label: "Today", icon: "check" }, { href: "/work-orders", label: "Requests", icon: "wrench" }, { href: "/frontdesk", label: "Front desk", icon: "shield" }, { href: "/comms", label: "Updates", icon: "mega" }],
  ADMIN: [{ href: "/today", label: "Today", icon: "check" }, { href: "/work-orders", label: "Requests", icon: "wrench" }, { href: "/comms", label: "Updates", icon: "mega" }, { href: "/admin/users", label: "Users", icon: "users" }],
  INVESTOR: [{ href: "/investor", label: "Snapshot", icon: "bars" }, { href: "/account", label: "Account", icon: "users" }],
  LANDLORD: [{ href: "/building-owner", label: "Overview", icon: "pulse" }, { href: "/account", label: "Account", icon: "users" }],
  CLIENT: [{ href: "/green", label: "Green", icon: "bolt" }, { href: "/green/clark", label: "Clark", icon: "pulse" }, { href: "/green/map", label: "3D map", icon: "box" }, { href: "/account", label: "Account", icon: "users" }],
  GUARD: [{ href: "/frontdesk", label: "Front desk", icon: "shield" }, { href: "/rounds", label: "Rounds", icon: "route" }, { href: "/tasks", label: "Tasks", icon: "vote" }, { href: "/sos", label: "SOS", icon: "alert" }],
};

// The BCDA client demo (lib/bcda.ts) sees its own building first, then the city views.
const BCDA_ITEMS: Item[] = [
  { href: "/green/bcda", label: "NGAC building", group: "Overview", icon: "home", roles: ["CLIENT"] },
  { href: "/green/map", label: "3D city map", group: "Overview", icon: "box", roles: ["CLIENT"] },
  { href: "/green/clark", label: "Clark command center", group: "Overview", icon: "pulse", roles: ["CLIENT"] },
];
const BCDA_TABS: Tab[] = [{ href: "/green/bcda", label: "Building", icon: "home" }, { href: "/green/map", label: "3D map", icon: "box" }, { href: "/green/clark", label: "Clark", icon: "pulse" }, { href: "/account", label: "Account", icon: "users" }];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireRole();
  if (!u.consented && !demoMode()) redirect("/consent");
  const isMgr = u.role === "MANAGER" || u.role === "ADMIN";
  const isStaff = isMgr || u.role === "GUARD";
  const [b, pending, escalated, unread, risk, sos, inquiries] = await Promise.all([
    prisma.building.findUnique({ where: { id: u.buildingId } }),
    isMgr ? prisma.announcement.count({ where: { status: "PENDING_APPROVAL" } }) : 0,
    isMgr ? prisma.workOrder.count({ where: { status: "ESCALATED" } }) : 0,
    u.role === "OWNER" ? prisma.delivery.count({ where: { userId: u.id, channel: "APP", readAt: null } }) : 0,
    isMgr ? prisma.pulse.count({ where: { score: { lte: 2 }, followedUp: null, createdAt: { gte: new Date(Date.now() - 45 * 86400000) } } }) : 0,
    isStaff ? prisma.sosAlert.count({ where: { status: { not: "RESOLVED" } } }) : 0,
    u.role === "OWNER" ? prisma.inquiry.count({ where: { listing: { userId: u.id }, status: "NEW" } }) : 0,
  ]);
  const toSign = u.role === "BOARD" || isMgr ? await prisma.purchaseRequest.count({ where: { status: "PENDING", requestedBy: { not: u.id } } }) : u.role === "GUARD" ? await prisma.purchaseRequest.count({ where: { status: "ORDERED" } }) : 0;
  const dataP0 = ["BOARD", "MANAGER", "ADMIN"].includes(u.role) ? await prisma.dataIssue.count({ where: { buildingId: u.buildingId, status: "OPEN", severity: "P0" } }) : 0;
  const overdue = u.role === "OWNER" ? 0 : tasksFor(await allTasks().catch(() => []), u.role).filter((t) => t.level >= 1).length;
  const counts: Record<string, number> = { "/tasks": overdue, "/comms": pending, "/work-orders": escalated, "/updates": unread, "/today": pending + escalated + risk, "/happiness": risk, "/sos": sos, "/property": inquiries, "/procurement": toSign, "/data": dataP0 };
  const bcdaClient = u.role === "CLIENT" && u.email.toLowerCase() === BCDA_LOGIN;
  const items = (bcdaClient ? BCDA_ITEMS : u.role === "BOARD" ? BOARD_ITEMS : ALL.filter((i) => i.roles.includes(u.role))).map(({ roles, ...i }) => ({ ...i, count: counts[i.href] || 0 }));
  items.push({ href: `${homeFor(u.role)}?tour=1`, label: "App tour", group: "Help", icon: "spark", count: 0 });
  const tabs = (bcdaClient ? BCDA_TABS : TABS[u.role] ?? []).map((t) => ({ ...t, count: counts[t.href] || 0 }));
  return (
    <Providers>
      <a href="#main" className="sr-only">Skip to content</a>
      <div className="app">
        <Nav items={items} tabs={tabs} fold={bcdaClient ? [] : FOLD[u.role] ?? []} user={{ name: u.name, role: u.role }} signOutTo={bcdaClient ? "/bcda?out=1" : "/login"} building={bcdaClient ? BCDA_NAME : u.role === "CLIENT" ? SITES[siteForEmail(u.email) ?? "ncc"].name : b?.name ?? ""} />
        <div className="main" id="main">
          {isStaff && sos > 0 && <Link href="/sos" className="sos-banner" role="alert"><b>SOS</b> {sos} emergency alert{sos > 1 ? "s" : ""} need{sos > 1 ? "" : "s"} a response now. Tap to open.</Link>}
          {overdue > 0 && u.role !== "BOARD" && <Link href="/tasks" className="overdue-banner"><b>{overdue} record{overdue > 1 ? "s" : ""} overdue.</b> Tap to enter {overdue > 1 ? "them" : "it"} now.</Link>}
          {children}
        </div>
        {["OWNER", "BOARD", "MANAGER", "ADMIN"].includes(u.role) && !bcdaClient && <AskFab audience={u.role === "OWNER" ? "owner" : "board"} name={u.name.split(" ")[0]} ai={aiEnabled()} canAct={u.role === "OWNER"} />}
        <Suspense fallback={null}><Tour uid={u.id} role={bcdaClient ? "CLIENT_BCDA" : u.role} /></Suspense>
      </div>
    </Providers>
  );
}
