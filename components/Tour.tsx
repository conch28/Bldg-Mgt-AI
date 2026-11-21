"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CARDS, TIPS, type Step } from "@/lib/tour";

const KEY = (uid: string) => `bmai-tour-v1-${uid}`;
const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
const find = (sel: string) => { try { return Array.from(document.querySelectorAll(sel)).find(visible) ?? null; } catch { return null; } };

/** Welcome cards on first sign-in (per user, per device), plus optional spotlight tips on key screens. */
export default function Tour({ uid, role }: { uid: string; role: string }) {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const cards = CARDS[role] ?? CARDS.OWNER;
  const tips = TIPS[path];
  const [card, setCard] = useState<number | null>(null);
  const [spot, setSpot] = useState<{ steps: (Step & { el: Element })[]; i: number } | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const touch = useRef<number | null>(null);

  const seen = useCallback(() => { try { localStorage.setItem(KEY(uid), new Date().toISOString()); } catch { /* private mode */ } }, [uid]);
  const startTips = useCallback(() => {
    const steps = (TIPS[location.pathname] ?? []).map((s) => ({ ...s, el: find(s.s) })).filter((s): s is Step & { el: Element } => !!s.el);
    if (steps.length) setSpot({ steps, i: 0 });
  }, []);

  // First visit, or "App tour" from the menu (?tour=1), or "Tips" (?tips=1).
  useEffect(() => {
    const replay = params.get("tour") === "1", tipsNow = params.get("tips") === "1";
    if (replay || tipsNow) router.replace(path, { scroll: false });
    if (replay) { setSpot(null); setCard(0); return; }
    if (tipsNow) { setTimeout(startTips, 350); return; }
    let done = false;
    try { done = !!localStorage.getItem(KEY(uid)); } catch { done = true; }
    if (!done) setCard(0);
  }, [params, path, router, uid, startTips]);

  useEffect(() => { setSpot(null); }, [path]);

  // Keep the highlight on its element while the page scrolls or resizes.
  useEffect(() => {
    if (!spot) { setRect(null); return; }
    const el = spot.steps[spot.i].el;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const upd = () => setRect(el.getBoundingClientRect());
    const t = setTimeout(upd, 380); upd();
    addEventListener("scroll", upd, true); addEventListener("resize", upd);
    return () => { clearTimeout(t); removeEventListener("scroll", upd, true); removeEventListener("resize", upd); };
  }, [spot]);

  const close = useCallback(() => { seen(); setCard(null); }, [seen]);
  const next = useCallback(() => setCard((c) => (c === null ? null : Math.min(c + 1, cards.length - 1))), [cards.length]);
  const prev = useCallback(() => setCard((c) => (c === null ? null : Math.max(c - 1, 0))), []);
  const stepTo = useCallback((d: number) => setSpot((s) => { if (!s) return s; const i = s.i + d; return i < 0 || i >= s.steps.length ? null : { ...s, i }; }), []);

  useEffect(() => {
    if (card === null && !spot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (spot) setSpot(null); else close(); }
      if (e.key === "ArrowRight") { if (spot) stepTo(1); else next(); }
      if (e.key === "ArrowLeft") { if (spot) stepTo(-1); else prev(); }
    };
    addEventListener("keydown", onKey);
    document.body.style.overflow = card !== null ? "hidden" : "";
    return () => { removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [card, spot, close, next, prev, stepTo]);

  if (card !== null) {
    const c = cards[card], last = card === cards.length - 1;
    return (
      <div className="tour-scrim" role="dialog" aria-modal="true" aria-labelledby="tour-t">
        <div className="tour-card" key={card}
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { const x = touch.current; touch.current = null; if (x === null) return; const dx = e.changedTouches[0].clientX - x; if (dx < -40) next(); if (dx > 40) prev(); }}>
          <button type="button" className="tour-skip" onClick={close}>{last ? "Close" : "Skip"}</button>
          <div className="tour-icon" aria-hidden="true">{c.icon}</div>
          <h2 id="tour-t">{c.t}</h2>
          <p>{c.b}</p>
          <div className="tour-dots" aria-label={`Card ${card + 1} of ${cards.length}`}>{cards.map((_, i) => <button type="button" key={i} className={i === card ? "on" : ""} aria-label={`Go to card ${i + 1}`} onClick={() => setCard(i)} />)}</div>
          <div className="tour-actions">
            {card > 0 ? <button type="button" className="btn" onClick={prev}>Back</button> : <span />}
            {!last ? <button type="button" className="btn pri" onClick={next}>Next</button>
              : tips ? <button type="button" className="btn pri" onClick={() => { close(); setTimeout(startTips, 250); }}>Show me around</button>
              : <button type="button" className="btn pri" onClick={close}>Get started</button>}
          </div>
          {last && tips && <button type="button" className="tour-later" onClick={close}>I&apos;ll explore on my own</button>}
        </div>
      </div>
    );
  }

  if (spot && rect) {
    const s = spot.steps[spot.i], pad = 6, vh = innerHeight, vw = innerWidth;
    // Put the tip below the element, else above it; a very tall element gets the tip pinned to the bottom of the screen.
    const need = 200, below = vh - rect.bottom - pad, above = rect.top - pad;
    const w = Math.min(320, vw - 24), left = Math.max(12, Math.min(rect.left + rect.width / 2 - w / 2, vw - w - 12));
    const pos = below >= need ? { top: rect.bottom + pad + 12 } : above >= need ? { bottom: vh - rect.top + pad + 12 } : { bottom: 16 };
    return (
      <div className="spot-wrap" onClick={() => setSpot(null)}>
        <div className="spot-hole" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
        <div className="spot-tip" role="dialog" aria-live="polite" aria-labelledby="spot-t" style={{ left, width: w, ...pos }} onClick={(e) => e.stopPropagation()}>
          <div className="hint">Tip {spot.i + 1} of {spot.steps.length}</div>
          <b id="spot-t">{s.t}</b>
          <p>{s.b}</p>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button type="button" className="tour-later" onClick={() => setSpot(null)}>End tips</button>
            <span className="row">
              {spot.i > 0 && <button type="button" className="btn sm" onClick={() => stepTo(-1)}>Back</button>}
              <button type="button" className="btn sm pri" onClick={() => stepTo(1)}>{spot.i === spot.steps.length - 1 ? "Done" : "Next"}</button>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return tips ? <button type="button" className="tips-fab" onClick={startTips} aria-label="Show tips for this screen">?</button> : null;
}
