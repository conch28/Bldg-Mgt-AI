"use client";
import { useFormStatus } from "react-dom";
export default function SubmitButton({ label, busy, cls = "btn pri", small }: { label: string; busy?: string; cls?: string; small?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={cls + (small ? " sm" : "")} disabled={pending}>{pending ? busy ?? "Saving…" : label}</button>;
}
