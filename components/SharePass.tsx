"use client";
import { useEffect, useState } from "react";

/** Send a visitor pass link by Messenger, Viber or the phone's share sheet. */
export default function SharePass({ code, name }: { code: string; name: string }) {
  const [url, setUrl] = useState(`/p/${code}`);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => { setUrl(`${location.origin}/p/${code}`); setCanShare(typeof navigator.share === "function"); }, [code]);
  const text = `Hi ${name.split(" ")[0]}! Here's your Skyland Plaza visitor pass. Show the QR to the lobby guard: ${url}`;
  return (
    <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 4 }}>
      {canShare && <button type="button" className="btn sm pri" onClick={() => navigator.share({ title: "Visitor pass", text, url }).catch(() => {})}>Share pass</button>}
      <a className="btn sm" href={`fb-messenger://share/?link=${encodeURIComponent(url)}`}>Messenger</a>
      <a className="btn sm" href={`viber://forward?text=${encodeURIComponent(text)}`}>Viber</a>
      <button type="button" className="btn sm" onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); }}>{copied ? "Copied" : "Copy link"}</button>
    </div>
  );
}
