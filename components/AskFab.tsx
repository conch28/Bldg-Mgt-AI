"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AskAI from "./AskAI";

/** The AI helper's face at the top right of every page. Opens the same Ask AI chat in a side sheet. */
export default function AskFab(props: { audience: "owner" | "board"; name: string; ai: boolean; canAct: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  if (path === "/ask") return null;
  return (
    <>
      <button type="button" className={"ask-fab" + (open ? " on" : "")} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close the AI helper" : "Open the AI helper"} title="Ask AI">
        <span className="ask-fab-face" aria-hidden="true">{open ? "✕" : "😊"}</span>
        <span className="ask-fab-dot" aria-hidden="true" />
      </button>
      {open && (
        <div className="ask-sheet-wrap" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="ask-sheet" role="dialog" aria-label="Ask AI">
            <AskAI {...props} compact />
            <Link href="/ask" className="ask-sheet-full">Open full page ›</Link>
          </div>
        </div>
      )}
    </>
  );
}
