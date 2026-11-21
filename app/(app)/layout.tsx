import Nav, { type NavItem } from "@/components/Nav";
import Providers from "../providers";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Item = NavItem & { roles: string[] };
const B = ["BOARD", "MANAGER", "ADMIN"], M = ["MANAGER", "ADMIN"], O = ["OWNER"];
const ALL: Item[] = [
  { href: "/home", label: "Home", group: "Home", icon: "home", roles: O },
  { href: "/chat", label: "Ask the helpdesk", group: "Home", icon: "chat", roles: O },
  { href: "/updates", label: "Building updates", group: "Home", icon: "mega", roles: O },
  { href: "/my", label: "Dues & statements", group: "My unit", icon: "card", roles: O },
  { href: "/amenities", label: "Book an amenity", group: "My unit", icon: "cal", roles: O },
  { href: "/passes", label: "Guest & delivery passes", group: "My unit", icon: "pass", roles: O },
  { href: "/services", label: "In-unit services", group: "My unit", icon: "bag", roles: O },
  { href: "/polls", label: "Voting", group: "Community", icon: "vote", roles: O },
  { href: "/documents", label: "Documents", group: "Community", icon: "folder", roles: O },

  { href: "/today", label: "Today", group: "Run the building", icon: "check", roles: M },
  { href: "/happiness", label: "Resident happiness", group: "Board", icon: "heart", roles: B },
  { href: "/board", label: "Building overview", group: "Board", icon: "pulse", roles: B },
  { href: "/reports", label: "Reports & finances", group: "Board", icon: "bars", roles: B },
  { href: "/scorecard", label: "Manager scorecard", group: "Board", icon: "medal", roles: B },
  { href: "/polls", label: "Voting & polls", group: "Board", icon: "vote", roles: ["BOARD"] },
  { href: "/work-orders", label: "Work orders", group: "Run the building", icon: "wrench", roles: B },
  { href: "/comms", label: "Resident updates", group: "Run the building", icon: "mega", roles: B },
  { href: "/collections", label: "Dues & collections", group: "Run the building", icon: "card", roles: B },
  { href: "/frontdesk", label: "Front desk", group: "Run the building", icon: "shield", roles: ["MANAGER", "ADMIN", "GUARD"] },
  { href: "/maintenance", label: "Maintenance calendar", group: "Run the building", icon: "gear", roles: B },
  { href: "/amenities", label: "Amenity bookings", group: "Run the building", icon: "cal", roles: M },
  { href: "/vendors", label: "Vendors & contracts", group: "Records", icon: "truck", roles: B },
  { href: "/documents", label: "Documents", group: "Records", icon: "folder", roles: B },
  { href: "/polls", label: "Voting & polls", group: "Records", icon: "vote", roles: M },
  { href: "/admin/users", label: "Users & units", group: "Admin", icon: "users", roles: ["ADMIN"] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireRole();
  const isMgr = u.role === "MANAGER" || u.role === "ADMIN";
  const [b, pending, escalated, unread, risk] = await Promise.all([
    prisma.building.findUnique({ where: { id: u.buildingId } }),
    isMgr ? prisma.announcement.count({ where: { status: "PENDING_APPROVAL" } }) : 0,
    isMgr ? prisma.workOrder.count({ where: { status: "ESCALATED" } }) : 0,
    u.role === "OWNER" ? prisma.delivery.count({ where: { userId: u.id, channel: "APP", readAt: null } }) : 0,
    isMgr ? prisma.pulse.count({ where: { score: { lte: 2 }, followedUp: null, createdAt: { gte: new Date(Date.now() - 45 * 86400000) } } }) : 0,
  ]);
  const counts: Record<string, number> = { "/comms": pending, "/work-orders": escalated, "/updates": unread, "/today": pending + escalated + risk, "/happiness": risk };
  const items = ALL.filter((i) => i.roles.includes(u.role)).map(({ roles, ...i }) => ({ ...i, count: counts[i.href] || 0 }));
  return (
    <Providers>
      <a href="#main" className="sr-only">Skip to content</a>
      <div className="app">
        <Nav items={items} user={{ name: u.name, role: u.role }} building={b?.name ?? ""} />
        <div className="main" id="main">{children}</div>
      </div>
    </Providers>
  );
}
