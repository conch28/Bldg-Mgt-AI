"use client";
import { useEffect, useState } from "react";

/** First-visit hint. Shows once per device until dismissed. */
export default function Tip({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(localStorage.getItem("tip-" + id) !== "1"); } catch { setShow(true); } }, [id]);
  if (!show) return null;
  return (
    <div className="tip" role="note">
      <span className="tip-i" aria-hidden="true">💡</span>
      <div style={{ flex: 1 }}><b>{title}</b><div>{children}</div></div>
      <button type="button" className="tip-x" aria-label="Got it, hide this tip" onClick={() => { setShow(false); try { localStorage.setItem("tip-" + id, "1"); } catch {} }}>Got it</button>
    </div>
  );
}
