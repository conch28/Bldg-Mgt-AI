"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import ThemeSwitch from "./ThemeSwitch";

export type NavItem = { href: string; label: string; group: string; icon: string; count?: number };
export type Tab = { href: string; label: string; icon: string; count?: number };
export const ICONS: Record<string, string> = {
  pulse: "M3 12h4l3-8 4 16 3-8h4", heart: "M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.2 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.8 0 6 3.8 4.5 7.3C19.5 16.4 12 21 12 21z", bars: "M4 20V10M10 20V4M16 20v-7M22 20H2", medal: "M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM8.5 12.5 7 22l5-3 5 3-1.5-9.5",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z", card: "M2 5h20v14H2zM2 10h20M6 15h4",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z", bag: "M3 10h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 10V6a5 5 0 0 1 10 0v4",
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", users: "M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M2 21v-2a4 4 0 0 1 3-3.9",
  mega: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14", cal: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  pass: "M3 7h18v10H3zM7 7v10M11 11h6M11 14h4", folder: "M3 6h6l2 2h10v11H3z", vote: "M4 13l4 4L20 5M4 21h16", truck: "M2 7h11v9H2zM13 10h5l3 3v3h-8M6 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.8.2l-.6.4-.4 2.2h-4l-.4-2.2-.6-.4a1.7 1.7 0 0 0-1.8-.2l-.2.1-2-3.4.1-.1a1.7 1.7 0 0 0 .3-1.8L4.6 9l.1-.1-.3-1.8L2.6 6l2-3.4", shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  doc: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7", upload: "M12 16V4M7 9l5-5 5 5M4 20h16", check: "M5 13l4 4L19 7",
  key: "M15 7a4 4 0 1 1-3.9 4.9L3 20v-3h3v-3h3l2.1-2.1A4 4 0 0 1 15 7zM16 9.5v.01", box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  paw: "M12 13c-3 0-5 3-5 5 0 1.5 1.2 2.5 2.6 2.1 1-.3 1.6-.6 2.4-.6s1.4.3 2.4.6c1.4.4 2.6-.6 2.6-2.1 0-2-2-5-5-5zM6 10a1.8 2.2 0 1 0 0-.1M18 10a1.8 2.2 0 1 0 0-.1M9.5 6a1.8 2.2 0 1 0 0-.1M14.5 6a1.8 2.2 0 1 0 0-.1",
  store: "M3 9l2-5h14l2 5M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 13v8h14v-8M10 21v-5h4v5", alert: "M12 3l10 18H2zM12 10v5M12 18v.01",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z", storm: "M7 16a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9a4 4 0 0 1-1 7.9M13 12l-3 5h4l-3 5", route: "M6 19a2 2 0 1 0 0-.1M18 5a2 2 0 1 0 0-.1M6 17V9a3 3 0 0 1 3-3h3M18 7v8a3 3 0 0 1-3 3h-3",
  cart: "M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2M9 20.5a1 1 0 1 0 0-.1M17 20.5a1 1 0 1 0 0-.1", bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5", cloud: "M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z", more: "M5 12v.01M12 12v.01M19 12v.01", x: "M6 6l12 12M18 6L6 18", tag: "M3 12V3h9l9 9-9 9zM7.5 7.5v.01", spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
};
export function Icon({ name, size = 17 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>;
}
const Logo = () => <div className="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 21V8l6-4v17M10 21V10l8 3v8M2 21h20M7 10v.01M7 13v.01M7 16v.01M14 15v.01M14 18v.01" /></svg></div>;

export default function Nav({ items, tabs, user, building }: { items: NavItem[]; tabs: Tab[]; user: { name: string; role: string }; building: string }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  useEffect(() => { document.body.style.overflow = more ? "hidden" : ""; }, [more]);
  const on = (href: string) => path === href || path.startsWith(href + "/");
  const groups = [...new Set(items.map((i) => i.group))];
  const inTabs = tabs.some((t) => on(t.href));
  const moreCount = items.filter((i) => !tabs.some((t) => t.href === i.href)).reduce((s, i) => s + (i.count || 0), 0);
  const list = (
    <>{groups.map((g) => (
      <nav className="navgroup" key={g} aria-label={g}><div className="lbl">{g}</div>
        {items.filter((i) => i.group === g).map((i) => (
          <Link key={i.href} href={i.href} className={"nav" + (on(i.href) ? " on" : "")} aria-current={on(i.href) ? "page" : undefined}>
            <Icon name={i.icon} />{i.label}{i.count ? <span className="count" aria-label={`${i.count} need attention`}>{i.count}</span> : null}
          </Link>
        ))}
      </nav>
    ))}</>
  );
  return (
    <>
      <aside className="side">
        <Link href="/" className="brand" style={{ textDecoration: "none" }}><Logo /><div><b>Building Mgt AI</b><small>{building}</small></div></Link>
        {list}
        <div className="userbox" style={{ marginTop: "auto" }}>
          <ThemeSwitch />
          <span><b>{user.name}</b><br />{user.role.toLowerCase()} · <Link href="/account" style={{ color: "inherit" }}>Account</Link></span>
          <button className="signout" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
        </div>
      </aside>

      <header className="mtop">
        <Link href="/" className="brand" style={{ textDecoration: "none" }} aria-label="Home"><Logo /><div><b>{building || "Building Mgt AI"}</b><small>Building Mgt AI</small></div></Link>
        {user.role === "OWNER" && <Link href="/sos" className="sos-btn" aria-label="Emergency SOS">SOS</Link>}
        <Link href="/account" className="mavatar" aria-label="Account">{user.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</Link>
      </header>

      <nav className="tabbar" aria-label="Main">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={on(t.href) && !more ? "on" : ""} aria-current={on(t.href) ? "page" : undefined}>
            <span className="ti"><Icon name={t.icon} size={22} />{t.count ? <i className="badge">{t.count > 9 ? "9+" : t.count}</i> : null}</span>{t.label}
          </Link>
        ))}
        <button type="button" className={more || !inTabs ? "on" : ""} onClick={() => setMore(!more)} aria-expanded={more} aria-controls="more-sheet">
          <span className="ti"><Icon name={more ? "x" : "more"} size={22} />{moreCount && !more ? <i className="badge">{moreCount > 9 ? "9+" : moreCount}</i> : null}</span>More
        </button>
      </nav>

      {more && (
        <div className="sheet-wrap" onClick={() => setMore(false)}>
          <div className="sheet" id="more-sheet" role="dialog" aria-label="All pages" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            {list}
            <div className="sheet-foot">
              <ThemeSwitch />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="hint"><b style={{ color: "var(--fg)" }}>{user.name}</b> · {user.role.toLowerCase()}</span>
                <span className="row"><Link href="/account" className="btn sm">Account</Link><button className="btn sm" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
