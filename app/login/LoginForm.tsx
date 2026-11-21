"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { requestCode, type CodeState } from "./actions";

const ACCOUNTS: [string, string, string, string][] = [
  ["🏠", "Unit owner", "Pay dues, report problems, rent out your unit", "owner@skyland.test"],
  ["⭐", "Board president", "Resident happiness, finances, approvals", "president@skyland.test"],
  ["🧰", "Property manager", "Today's to-do list, tickets, updates", "manager@skyland.test"],
  ["🛡️", "Lobby guard", "Visitor passes, SOS alerts, moves", "guard@skyland.test"],
];

const errText = (e?: string | null) => e === "RATE_LIMIT" ? "Too many tries. Please wait 15 minutes and try again." : e;

export default function LoginForm({ demo }: { demo: boolean }) {
  const [err, setErr] = useState(""); const [busy, setBusy] = useState<string | null>(null);
  async function go(e: string, p: string) {
    setBusy(e); setErr("");
    const r = await signIn("credentials", { email: e, password: p, redirect: false });
    if (r?.ok) window.location.href = "/"; else { setBusy(null); setErr(r?.error === "RATE_LIMIT" ? errText(r.error)! : "That email and password don't match an active account."); }
  }
  return (
    <div className="login">
      <div className="box">
        <div className="brand" style={{ padding: 0, marginBottom: 20 }}>
          <div className="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 21V8l6-4v17M10 21V10l8 3v8M2 21h20" /></svg></div>
          <div><b style={{ fontFamily: "var(--display)", fontSize: 17 }}>Skyland Plaza</b><div className="hint">Managed by Building Mgt AI</div></div>
        </div>
        {demo ? <>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>Try the demo</h2>
          <p className="hint" style={{ margin: "0 0 14px" }}>Tap who you want to be. No password needed.</p>
          <div className="roles">{ACCOUNTS.map(([i, t, s, e]) => (
            <button type="button" key={e} className="role" disabled={!!busy} onClick={() => go(e, "Skyland2026!")}>
              <span className="ri" aria-hidden="true">{i}</span><span style={{ flex: 1 }}><b>{t}</b><small>{busy === e ? "Opening…" : s}</small></span><span aria-hidden="true" className="chev">›</span>
            </button>))}
          </div>
          {err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}
          <details className="signin-more"><summary>Sign in with email instead</summary><PasswordForm busy={busy} go={go} /></details>
          <details className="signin-more"><summary>Try the one-time code sign-in</summary><div style={{ marginTop: 12 }}><CodeForm /></div></details>
        </> : <>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>Sign in</h2>
          <p className="hint" style={{ margin: "0 0 14px" }}>We&apos;ll send a 6-digit code to your email or phone. No password to remember.</p>
          <CodeForm />
          <details className="signin-more"><summary>Use a password instead</summary>{err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}<PasswordForm busy={busy} go={go} /></details>
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

function PasswordForm({ busy, go }: { busy: string | null; go: (e: string, p: string) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); go(email, password); }} style={{ marginTop: 12 }}>
      <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <button className="btn pri" style={{ width: "100%", justifyContent: "center" }} disabled={!!busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
