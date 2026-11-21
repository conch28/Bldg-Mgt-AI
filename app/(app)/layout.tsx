import Nav, { type NavItem } from "@/components/Nav";
import Providers from "../providers";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ALL: (NavItem & { roles: string[] })[] = [
  { href: "/board", label: "Today at Skyland", group: "Board", icon: "pulse", roles: ["BOARD", "MANAGER", "ADMIN"] },
  { href: "/finances", label: "Finances & reports", group: "Board", icon: "bars", roles: ["BOARD", "MANAGER", "ADMIN"] },
  { href: "/scorecard", label: "Manager scorecard", group: "Board", icon: "medal", roles: ["BOARD", "MANAGER", "ADMIN"] },
  { href: "/work-orders", label: "Work orders", group: "Operations", icon: "wrench", roles: ["BOARD", "MANAGER", "ADMIN"] },
  { href: "/collections", label: "Dues & collections", group: "Operations", icon: "card", roles: ["BOARD", "MANAGER", "ADMIN"] },
  { href: "/my", label: "My unit", group: "Owner", icon: "home", roles: ["OWNER"] },
  { href: "/chat", label: "Helpdesk chat", group: "Owner", icon: "chat", roles: ["OWNER"] },
  { href: "/services", label: "Services", group: "Owner", icon: "bag", roles: ["OWNER"] },
  { href: "/admin/users", label: "Users & units", group: "Admin", icon: "users", roles: ["ADMIN"] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireRole();
  const b = await prisma.building.findUnique({ where: { id: u.buildingId } });
  return (
    <Providers>
      <div className="app">
        <Nav items={ALL.filter((i) => i.roles.includes(u.role))} user={{ name: u.name, role: u.role }} building={b?.name ?? ""} />
        <div className="main">{children}</div>
      </div>
    </Providers>
  );
}
