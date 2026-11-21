import Link from "next/link";
import Nav, { type NavItem, type Tab } from "@/components/Nav";
import Providers from "../providers";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { demoMode } from "@/lib/env";

type Item = NavItem & { roles: string[] };
const B = ["BOARD", "MANAGER", "ADMIN"], M = ["MANAGER", "ADMIN"], O = ["OWNER"], STAFF = ["MANAGER", "ADMIN", "GUARD"];
// Grouped list for the desktop sidebar and the phone "More" sheet. Keep groups short: people scan, they don't read.
const ALL: Item[] = [
  { href: "/home", label: "Home", group: "Everyday", icon: "home", roles: O },
  { href: "/my", label: "Bills & dues", group: "Everyday", icon: "card", roles: O },
  { href: "/chat", label: "Helpdesk", group: "Everyday", icon: "chat", roles: O },
  { href: "/updates", label: "Building updates", group: "Everyday", icon: "mega", roles: O },
  { href: "/property", label: "Rent out or sell", group: "My unit", icon: "key", roles: O },
  { href: "/passes", label: "Guest & stay passes", group: "My unit", icon: "pass", roles: O },
  { href: "/amenities", label: "Book an amenity", group: "My unit", icon: "cal", roles: O },
  { href: "/moving", label: "Moving & renovation", group: "My unit", icon: "box", roles: O },
  { href: "/registrations", label: "Pets & vehicles", group: "My unit", icon: "paw", roles: O },
  { href: "/services", label: "In-unit services", group: "My unit", icon: "bag", roles: O },
  { href: "/community", label: "Marketplace & lost and found", group: "Community", icon: "store", roles: O },
  { href: "/polls", label: "Voting", group: "Community", icon: "vote", roles: O },
  { href: "/documents", label: "Documents", group: "Community", icon: "folder", roles: O },
  { href: "/sos", label: "Emergency SOS", group: "Community", icon: "alert", roles: O },

  { href: "/today", label: "Today", group: "Run the building", icon: "check", roles: M },
  { href: "/frontdesk", label: "Front desk", group: "Run the building", icon: "shield", roles: STAFF },
  { href: "/sos", label: "SOS alerts", group: "Run the building", icon: "alert", roles: STAFF },
  { href: "/work-orders", label: "Work orders", group: "Run the building", icon: "wrench", roles: B },
  { href: "/comms", label: "Resident updates", group: "Run the building", icon: "mega", roles: B },
  { href: "/collections", label: "Dues & collections", group: "Run the building", icon: "card", roles: B },
  { href: "/moving", label: "Moves & renovations", group: "Run the building", icon: "box", roles: STAFF },
  { href: "/registrations", label: "Pets & vehicles", group: "Run the building", icon: "paw", roles: STAFF },
  { href: "/community", label: "Lost & found, marketplace", group: "Run the building", icon: "store", roles: STAFF },
  { href: "/happiness", label: "Resident happiness", group: "Board", icon: "heart", roles: B },
  { href: "/board", label: "Building overview", group: "Board", icon: "pulse", roles: B },
  { href: "/reports", label: "Reports & finances", group: "Board", icon: "bars", roles: B },
  { href: "/scorecard", label: "Manager scorecard", group: "Board", icon: "medal", roles: B },
  { href: "/listings", label: "Units for sale & lease", group: "Board", icon: "key", roles: B },
  { href: "/polls", label: "Voting & polls", group: "Board", icon: "vote", roles: B },
  { href: "/maintenance", label: "Maintenance calendar", group: "Records", icon: "gear", roles: B },
  { href: "/amenities", label: "Amenity bookings", group: "Records", icon: "cal", roles: M },
  { href: "/vendors", label: "Vendors & contracts", group: "Records", icon: "truck", roles: B },
  { href: "/documents", label: "Documents", group: "Records", icon: "folder", roles: B },
  { href: "/admin/users", label: "Users & units", group: "Records", icon: "users", roles: ["ADMIN"] },
  { href: "/admin/import", label: "Import data", group: "Records", icon: "doc", roles: ["ADMIN"] },
  { href: "/admin/system", label: "System & privacy", group: "Records", icon: "shield", roles: ["ADMIN"] },
];
// Bottom tab bar on phones: four destinations per role plus "More".
const TABS: Record<string, Tab[]> = {
  OWNER: [{ href: "/home", label: "Home", icon: "home" }, { href: "/my", label: "Bills", icon: "card" }, { href: "/chat", label: "Help", icon: "chat" }, { href: "/property", label: "My unit", icon: "key" }],
  BOARD: [{ href: "/happiness", label: "Happiness", icon: "heart" }, { href: "/board", label: "Overview", icon: "pulse" }, { href: "/reports", label: "Reports", icon: "bars" }, { href: "/polls", label: "Voting", icon: "vote" }],
  MANAGER: [{ href: "/today", label: "Today", icon: "check" }, { href: "/work-orders", label: "Requests", icon: "wrench" }, { href: "/frontdesk", label: "Front desk", icon: "shield" }, { href: "/comms", label: "Updates", icon: "mega" }],
  ADMIN: [{ href: "/today", label: "Today", icon: "check" }, { href: "/work-orders", label: "Requests", icon: "wrench" }, { href: "/comms", label: "Updates", icon: "mega" }, { href: "/admin/users", label: "Users", icon: "users" }],
  GUARD: [{ href: "/frontdesk", label: "Front desk", icon: "shield" }, { href: "/sos", label: "SOS", icon: "alert" }, { href: "/moving", label: "Moves", icon: "box" }, { href: "/community", label: "Lost & found", icon: "store" }],
};

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
  const counts: Record<string, number> = { "/comms": pending, "/work-orders": escalated, "/updates": unread, "/today": pending + escalated + risk, "/happiness": risk, "/sos": sos, "/property": inquiries };
  const items = ALL.filter((i) => i.roles.includes(u.role)).map(({ roles, ...i }) => ({ ...i, count: counts[i.href] || 0 }));
  const tabs = (TABS[u.role] ?? []).map((t) => ({ ...t, count: counts[t.href] || 0 }));
  return (
    <Providers>
      <a href="#main" className="sr-only">Skip to content</a>
      <div className="app">
        <Nav items={items} tabs={tabs} user={{ name: u.name, role: u.role }} building={b?.name ?? ""} />
        <div className="main" id="main">
          {isStaff && sos > 0 && <Link href="/sos" className="sos-banner" role="alert"><b>SOS</b> {sos} emergency alert{sos > 1 ? "s" : ""} need{sos > 1 ? "" : "s"} a response now. Tap to open.</Link>}
          {children}
        </div>
      </div>
    </Providers>
  );
}
