import { requireRole } from "@/lib/auth";
import Notice from "../privacy/Notice";
import SubmitButton from "@/components/SubmitButton";
import { acceptNotice } from "./actions";

export const dynamic = "force-dynamic";
export default async function Consent({ searchParams }: { searchParams: { need?: string } }) {
  const u = await requireRole();
  return (
    <div className="login"><div className="box" style={{ maxWidth: 720 }}>
      <h2 style={{ fontSize: 24, marginBottom: 4 }}>Welcome, {u.name.split(" ")[0]} po!</h2>
      <p className="hint" style={{ marginTop: 0 }}>Before you start, here is how we take care of your information.</p>
      <details className="card more" style={{ marginBottom: 14 }}><summary><b>Read the privacy notice</b> (2 minutes)</summary><Notice /></details>
      {searchParams.need && <div className="err" style={{ marginBottom: 12 }}>Please tick the box to continue.</div>}
      <form action={acceptNotice}>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 }}><input type="checkbox" name="agree" style={{ marginTop: 4 }} /> <span>I have read the privacy notice and agree that Skyland Plaza and Building Mgt AI may use my information as described.</span></label>
        <SubmitButton label="Continue" cls="btn pri" />
      </form>
    </div></div>
  );
}
