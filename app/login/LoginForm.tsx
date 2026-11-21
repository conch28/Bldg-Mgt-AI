"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

const ACCOUNTS: [string, string, string, string][] = [
  ["🏠", "Unit owner", "Pay dues, report problems, rent out your unit", "owner@skyland.test"],
  ["⭐", "Board president", "Resident happiness, finances, approvals", "president@skyland.test"],
  ["🧰", "Property manager", "Today's to-do list, tickets, updates", "manager@skyland.test"],
  ["🛡️", "Lobby guard", "Visitor passes, SOS alerts, moves", "guard@skyland.test"],
];

export default function LoginForm({ demo }: { demo: boolean }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState<string | null>(null);
  async function go(e: string, p: string) {
    setBusy(e); setErr("");
    const r = await signIn("credentials", { email: e, password: p, redirect: false });
    if (r?.ok) window.location.href = "/"; else { setBusy(null); setErr("That email and password don't match an active account."); }
  }
  return (
    <div className="login">
      <div className="box">
        <div className="brand" style={{ padding: 0, marginBottom: 20 }}>
          <div className="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 21V8l6-4v17M10 21V10l8 3v8M2 21h20" /></svg></div>
          <div><b style={{ fontFamily: "var(--display)", fontSize: 17 }}>Skyland Tower</b><div className="hint">Managed by Building Mgt AI</div></div>
        </div>
        {demo && <>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>Try the demo</h2>
          <p className="hint" style={{ margin: "0 0 14px" }}>Tap who you want to be. No password needed.</p>
          <div className="roles">{ACCOUNTS.map(([i, t, s, e]) => (
            <button type="button" key={e} className="role" disabled={!!busy} onClick={() => go(e, "Skyland2026!")}>
              <span className="ri" aria-hidden="true">{i}</span><span style={{ flex: 1 }}><b>{t}</b><small>{busy === e ? "Opening…" : s}</small></span><span aria-hidden="true" className="chev">›</span>
            </button>))}
          </div>
          {err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}
          <details className="signin-more"><summary>Sign in with email instead</summary><EmailForm {...{ email, setEmail, password, setPassword, busy, go }} /></details>
        </>}
        {!demo && <><h2 style={{ fontSize: 22, marginBottom: 14 }}>Sign in</h2>{err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}<EmailForm {...{ email, setEmail, password, setPassword, busy, go }} /></>}
      </div>
    </div>
  );
}

function EmailForm({ email, setEmail, password, setPassword, busy, go }: { email: string; setEmail: (v: string) => void; password: string; setPassword: (v: string) => void; busy: string | null; go: (e: string, p: string) => void }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); go(email, password); }} style={{ marginTop: 12 }}>
      <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <button className="btn pri" style={{ width: "100%", justifyContent: "center" }} disabled={!!busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
