"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Nav";

export function RegisterSW() {
  useEffect(() => { if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker?.register("/sw.js").catch(() => {}); }, []);
  return null;
}

/** "Add to home screen" card. Android/Chrome: one tap install. iPhone: short instructions. Hidden once installed. */
export function InstallApp() {
  const [evt, setEvt] = useState<any>(null);
  const [ios, setIos] = useState(false);
  const [hide, setHide] = useState(true);
  useEffect(() => {
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    let dismissed = false; try { dismissed = localStorage.getItem("install-dismissed") === "1"; } catch {}
    if (standalone || dismissed) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos); if (isIos) setHide(false);
    const h = (e: Event) => { e.preventDefault(); setEvt(e); setHide(false); };
    addEventListener("beforeinstallprompt", h); return () => removeEventListener("beforeinstallprompt", h);
  }, []);
  if (hide) return null;
  const close = () => { setHide(true); try { localStorage.setItem("install-dismissed", "1"); } catch {} };
  return (
    <div className="card install">
      <span className="ti"><Icon name="home" size={22} /></span>
      <div style={{ flex: 1 }}><b>Add Skyland to your home screen</b>
        <div className="hint">{ios ? "Tap the Share button, then \"Add to Home Screen\". It opens like an app." : "Opens like an app, with SOS one tap away."}</div></div>
      {evt && <button className="btn pri sm" onClick={async () => { evt.prompt(); await evt.userChoice; close(); }}>Install</button>}
      <button className="btn sm" onClick={close} aria-label="Dismiss">Later</button>
    </div>
  );
}
