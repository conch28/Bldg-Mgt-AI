"use client";
import { useFormState } from "react-dom";
import SubmitButton from "./SubmitButton";
import { createUser, resetPassword } from "@/app/(app)/admin/users/actions";

type R = { ok?: string; error?: string } | undefined;
export function CreateUserForm() {
  const [state, action] = useFormState<R, FormData>(createUser as any, undefined);
  return (
    <form action={action}>
      <div className="inline-form">
        <input name="name" required placeholder="Full name" aria-label="Full name" />
        <input name="email" type="email" required placeholder="Email" aria-label="Email" />
        <select name="role" aria-label="Role"><option value="OWNER">Owner</option><option value="BOARD">Board</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option></select>
        <input name="unit" placeholder="Unit (owners)" aria-label="Unit" style={{ width: 110 }} />
        <input name="phone" placeholder="Mobile +63…" aria-label="Mobile" style={{ width: 140 }} />
        <SubmitButton label="Create account" small />
      </div>
      {state?.error && <div className="err" style={{ marginTop: 10 }}>{state.error}</div>}
      {state?.ok && <div className="okmsg" style={{ marginTop: 10 }}>{state.ok}</div>}
    </form>
  );
}
export function ResetForm({ id }: { id: string }) {
  const [state, action] = useFormState<R, FormData>(resetPassword as any, undefined);
  return <form action={action} className="inline-form"><input type="hidden" name="id" value={id} /><SubmitButton label="Reset password" small cls="btn" />{state?.ok && <span className="mono" style={{ fontSize: 11.5 }}>{state.ok}</span>}</form>;
}
