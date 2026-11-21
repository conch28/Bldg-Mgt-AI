"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export type NavItem = { href: string; label: string; group: string; icon: string };
const ICONS: Record<string, string> = {
  pulse: "M3 12h4l3-8 4 16 3-8h4", bars: "M4 20V10M10 20V4M16 20v-7M22 20H2", medal: "M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM8.5 12.5 7 22l5-3 5 3-1.5-9.5",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z", card: "M2 5h20v14H2zM2 10h20M6 15h4",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z", bag: "M3 10h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 10V6a5 5 0 0 1 10 0v4",
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", users: "M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M2 21v-2a4 4 0 0 1 3-3.9",
};

export default function Nav({ items, user, building }: { items: NavItem[]; user: { name: string; role: string }; building: string }) {
  const path = usePathname();
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <aside className="side">
      <div className="brand">
        <div className="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 21V8l6-4v17M10 21V10l8 3v8M2 21h20M7 10v.01M7 13v.01M7 16v.01M14 15v.01M14 18v.01" /></svg></div>
        <div><b>Building Mgt AI</b><small>{building}</small></div>
      </div>
      {groups.map((g) => (
        <div className="navgroup" key={g}><div className="lbl">{g}</div>
          {items.filter((i) => i.group === g).map((i) => (
            <Link key={i.href} href={i.href} className={"nav" + (path.startsWith(i.href) ? " on" : "")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={ICONS[i.icon]} /></svg>{i.label}
            </Link>
          ))}
        </div>
      ))}
      <div className="userbox" style={{ marginTop: "auto" }}>
        <span><b>{user.name}</b><br />{user.role.toLowerCase()} · <Link href="/account" style={{ color: "inherit" }}>Account</Link></span>
        <button className="signout" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
      </div>
    </aside>
  );
}
