"use client";
import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { requestCode, type CodeState } from "./actions";

const ACCOUNTS: [string, string, string, string][] = [
  ["🏠", "Unit owner", "Pay dues, report problems, rent out your unit", "owner@skyland.test"],
  ["⭐", "Board president", "Resident happiness, finances, approvals", "president@skyland.test"],
  ["🧰", "Property manager", "Today's to-do list, tickets, updates", "manager@skyland.test"],
  ["🛡️", "Lobby guard", "Visitor passes, SOS alerts, moves", "guard@skyland.test"],
  ["🏢", "Building owner", "Occupancy, income, spending, asset health", "building@skyland.test"],
  ["📈", "Investor", "Business snapshot: unit economics and results", "investor@skyland.test"],
  ["🔑", "Admin", "Everything: users, data, settings, all demo views", "admin@skyland.test"],
];

// Client demos (lib/green.ts, lib/bcda.ts), opened only by their own links (/login?client=ncc|pax|bcda), not listed on the main demo screen.
const GREEN: [string, string, string, string, string][] = [
  ["ncc", "🌿", "New Clark City", "Green smart city: cut power and water, track carbon", "ncc@greendemo.test"],
  ["pax", "🔬", "Pax Silica hub", "AI-native industrial hub: data hall PUE, water reuse, solar", "pax@greendemo.test"],
  ["bcda", "🏛️", "BCDA · NGAC building", "Uptime, energy, assets, COA-ready spending, leases, safety", "bcda@greendemo.test"],
];

const errText = (e?: string | null) => e === "RATE_LIMIT" ? "Too many tries. Please wait 15 minutes and try again." : e;

export default function LoginForm({ demo, client, noAuto }: { demo: boolean; client?: string; noAuto?: boolean }) {
  // The BCDA link is shared on its own, so it carries no Skyland branding and no link to the other demos.
  const bcda = demo && client === "bcda";
  const [err, setErr] = useState(""); const [busy, setBusy] = useState<string | null>(null);
  // Client links (/login?client=bcda) open straight into that demo, no tap needed.
  const auto = useRef(false);
  useEffect(() => {
    if (!demo || !client || noAuto || auto.current) return;
    const row = GREEN.find(([k]) => k === client);
    if (row) { auto.current = true; go(row[4]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, client, noAuto]);
  async function go(e: string) {
    setBusy(e); setErr("");
    const r = await signIn("credentials", { email: e, redirect: false });
    if (r?.ok) window.location.href = "/"; else { setBusy(null); setErr(r?.error === "RATE_LIMIT" ? errText(r.error)! : "That email doesn't match an active account."); }
  }
  return (
    <div className="login">
      <div className="box">
        <div className="brand" style={{ padding: 0, marginBottom: 20 }}>
          <div className="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 21V8l6-4v17M10 21V10l8 3v8M2 21h20" /></svg></div>
          {bcda ? <div><b style={{ fontFamily: "var(--display)", fontSize: 17 }}>NGAC Government Building</b><div className="hint">BCDA · New Clark City</div></div>
            : <div><b style={{ fontFamily: "var(--display)", fontSize: 17 }}>Skyland Plaza</b><div className="hint">Managed by Building Mgt AI</div></div>}
        </div>
        {demo && client ? <>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>{client === "bcda" ? "Your building management demo" : "Your sustainability demo"}</h2>
          <p className="hint" style={{ margin: "0 0 14px" }}>One tap to open it. No password needed.</p>
          <div className="roles">{GREEN.filter(([k]) => k === client).map(([, i, t, s, e]) => (
            <button type="button" key={e} className="role green-role" disabled={!!busy} onClick={() => go(e)}>
              <span className="ri" aria-hidden="true">{i}</span><span style={{ flex: 1 }}><b>{t}</b><small>{busy === e ? "Opening…" : s}</small></span><span aria-hidden="true" className="chev">›</span>
            </button>))}
          </div>
          {err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}
          {!bcda && <p className="hint" style={{ marginTop: 14 }}><a href="/login">See the Skyland demo</a></p>}
        </> : demo ? <>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>Try the demo</h2>
          <p className="hint" style={{ margin: "0 0 14px" }}>Tap who you want to be. No password needed.</p>
          <div className="roles">{ACCOUNTS.map(([i, t, s, e]) => (
            <button type="button" key={e} className="role" disabled={!!busy} onClick={() => go(e)}>
              <span className="ri" aria-hidden="true">{i}</span><span style={{ flex: 1 }}><b>{t}</b><small>{busy === e ? "Opening…" : s}</small></span><span aria-hidden="true" className="chev">›</span>
            </button>))}
          </div>
          {err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}
          <details className="signin-more"><summary>Sign in with your own email</summary><EmailOnlyForm busy={busy} go={go} /></details>
          <details className="signin-more"><summary>Try the one-time code sign-in</summary><div style={{ marginTop: 12 }}><CodeForm /></div></details>
        </> : <>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>Sign in</h2>
          <p className="hint" style={{ margin: "0 0 14px" }}>We&apos;ll send a 6-digit code to your email or phone. No password to remember.</p>
          <CodeForm />
          {err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}
          <p className="hint" style={{ marginTop: 18, fontSize: 12 }}>By signing in you agree to how we handle your data in our <a href="/privacy">privacy notice</a>.</p>
        </>}
      </div>
    </div>
  );
}

function SendBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn pri" style={{ width: "100%", justifyContent: "center" }} disabled={pending}>{pending ? "Sending…" : label}</button>;
}

function CodeForm() {
  const [state, action] = useFormState<CodeState, FormData>(requestCode, {});
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  if (!state.sent) return (
    <form action={action}>
      {state.error && <div className="err" style={{ marginBottom: 12 }} role="alert">{state.error}</div>}
      <div className="field"><label htmlFor="ident">Email or mobile number</label><input id="ident" name="identifier" autoComplete="username" inputMode="email" placeholder="you@email.com or 0917 123 4567" required /></div>
      <SendBtn label="Send me a code" />
    </form>
  );
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await signIn("otp", { identifier: state.identifier, code, redirect: false });
    if (r?.ok) window.location.href = "/"; else { setBusy(false); setErr(r?.error === "RATE_LIMIT" ? errText(r.error)! : "That code is wrong or has expired. Check it, or send a new one."); }
  }
  return (
    <form onSubmit={verify}>
      <div className="okmsg" style={{ marginBottom: 12 }}>If <b>{state.to}</b> belongs to an account, a code is on its way. It works for 10 minutes.</div>
      {state.demoCode && <div className="tip" style={{ marginBottom: 12 }}><b>Demo:</b> texts and emails are off in the demo, so here is the code: <b className="mono">{state.demoCode}</b></div>}
      {err && <div className="err" style={{ marginBottom: 12 }} role="alert">{err}</div>}
      <div className="field"><label htmlFor="code">6-digit code</label><input id="code" name="code" className="codeinput" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
      <button className="btn pri" style={{ width: "100%", justifyContent: "center" }} disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>
      <button type="button" className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => window.location.reload()}>Use a different email or number</button>
    </form>
  );
}

/** Demo site only: no password, the email alone opens the account. */
function EmailOnlyForm({ busy, go }: { busy: string | null; go: (e: string) => void }) {
  const [email, setEmail] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); go(email); }} style={{ marginTop: 12 }}>
      <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" /></div>
      <p className="hint" style={{ margin: "0 0 10px" }}>This is a demo, so no password is needed.</p>
      <button className="btn pri" style={{ width: "100%", justifyContent: "center" }} disabled={!!busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
