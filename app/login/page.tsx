"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

const DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === "1";
const ACCOUNTS = [["Owner (Unit 12B)", "owner@skyland.test"], ["Board president", "president@skyland.test"], ["Property manager", "manager@skyland.test"], ["Admin", "admin@skyland.test"]];

export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (r?.ok) window.location.href = "/"; else setErr("That email and password don't match an active account.");
  }
  return (
    <div className="login">
      <form className="box" onSubmit={submit}>
        <div className="brand" style={{ padding: 0, marginBottom: 18 }}>
          <div className="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 21V8l6-4v17M10 21V10l8 3v8M2 21h20" /></svg></div>
          <div><b style={{ fontFamily: "var(--display)", fontSize: 16 }}>Skyland Tower</b><div className="hint">Managed by Building Mgt AI</div></div>
        </div>
        <h2 style={{ fontSize: 20, marginBottom: 14 }}>Sign in</h2>
        {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
        <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn pri" style={{ width: "100%", justifyContent: "center", padding: 10 }} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        {DEMO && (
          <div style={{ marginTop: 18 }}>
            <div className="hint" style={{ marginBottom: 6 }}>Demo accounts (password <span className="mono">Skyland2026!</span>)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ACCOUNTS.map(([l, e]) => <button type="button" key={e} className="chip" onClick={() => { setEmail(e); setPassword("Skyland2026!"); }}>{l}</button>)}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
