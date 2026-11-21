"use client";
import { useFormState } from "react-dom";
import SubmitButton from "./SubmitButton";
import { changePassword } from "@/app/(app)/account/actions";
export default function ChangePassword() {
  const [s, action] = useFormState<{ ok?: string; error?: string } | undefined, FormData>(changePassword as any, undefined);
  return (<form action={action} style={{ marginTop: 10 }}>
    <div className="field"><label htmlFor="current">Current password</label><input id="current" name="current" type="password" required autoComplete="current-password" /></div>
    <div className="field"><label htmlFor="next">New password</label><input id="next" name="next" type="password" required minLength={10} autoComplete="new-password" /></div>
    {s?.error && <div className="err" style={{ marginBottom: 10 }}>{s.error}</div>}{s?.ok && <div className="okmsg" style={{ marginBottom: 10 }}>{s.ok}</div>}
    <SubmitButton label="Change password" small /></form>);
}
