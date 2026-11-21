"use client";
import { useRef, useState } from "react";
import { shrinkImage } from "@/lib/image";

/** Camera/file button that shrinks the photo on the phone and puts it in a hidden form field. */
export default function PhotoField({ name = "photo", label = "Take photo", required }: { name?: string; label?: string; required?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="photo-field">
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setErr(""); try { setVal(await shrinkImage(f, 720, 0.65)); } catch (x) { setErr((x as Error).message); } }} />
      <input type="hidden" name={name} value={val} />
      <button type="button" className="btn" onClick={() => input.current?.click()}>{val ? "Retake photo" : label}{required && !val ? " *" : ""}</button>
      {val && <img src={val} alt="Photo to attach" className="stop-thumb" />}
      {err && <span className="hint" style={{ color: "var(--bad)" }}>{err}</span>}
    </div>
  );
}
