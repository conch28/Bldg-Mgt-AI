"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import ThemeSwitch from "./ThemeSwitch";

export type NavItem = { href: string; label: string; group: string; icon: string; count?: number };
export const ICONS: Record<string, string> = {
  pulse: "M3 12h4l3-8 4 16 3-8h4", bars: "M4 20V10M10 20V4M16 20v-7M22 20H2", medal: "M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM8.5 12.5 7 22l5-3 5 3-1.5-9.5",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z", card: "M2 5h20v14H2zM2 10h20M6 15h4",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z", bag: "M3 10h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 10V6a5 5 0 0 1 10 0v4",
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", users: "M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M2 21v-2a4 4 0 0 1 3-3.9",
  mega: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14", cal: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  pass: "M3 7h18v10H3zM7 7v10M11 11h6M11 14h4", folder: "M3 6h6l2 2h10v11H3z", vote: "M4 13l4 4L20 5M4 21h16", truck: "M2 7h11v9H2zM13 10h5l3 3v3h-8M6 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.8.2l-.6.4-.4 2.2h-4l-.4-2.2-.6-.4a1.7 1.7 0 0 0-1.8-.2l-.2.1-2-3.4.1-.1a1.7 1.7 0 0 0 .3-1.8L4.6 9l.1-.1-.3-1.8L2.6 6l2-3.4", shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  doc: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7", upload: "M12 16V4M7 9l5-5 5 5M4 20h16", check: "M5 13l4 4L19 7",
};
export function Icon({ name, size = 17 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[name]} /></svg>;
}

export default function Nav({ items, user, building }: { items: NavItem[]; user: { name: string; role: string }; building: string }) {
  const path = usePathname();
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <aside className="side">
      <Link href="/" className="brand" style={{ textDecoration: "none" }}>
        <div className="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 21V8l6-4v17M10 21V10l8 3v8M2 21h20M7 10v.01M7 13v.01M7 16v.01M14 15v.01M14 18v.01" /></svg></div>
        <div><b>Building Mgt AI</b><small>{building}</small></div>
      </Link>
      {groups.map((g) => (
        <nav className="navgroup" key={g} aria-label={g}><div className="lbl">{g}</div>
          {items.filter((i) => i.group === g).map((i) => (
            <Link key={i.href} href={i.href} className={"nav" + (path === i.href || path.startsWith(i.href + "/") ? " on" : "")} aria-current={path.startsWith(i.href) ? "page" : undefined}>
              <Icon name={i.icon} />{i.label}{i.count ? <span className="count" aria-label={`${i.count} need attention`}>{i.count}</span> : null}
            </Link>
          ))}
        </nav>
      ))}
      <div className="userbox" style={{ marginTop: "auto" }}>
        <ThemeSwitch />
        <span><b>{user.name}</b><br />{user.role.toLowerCase()} · <Link href="/account" style={{ color: "inherit" }}>Account</Link></span>
        <button className="signout" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
      </div>
    </aside>
  );
}
