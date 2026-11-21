"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Guard's camera scanner for visitor QR codes. Uses the browser's BarcodeDetector; falls back to typing the code. */
export default function QrScan() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null, raf = 0, alive = true;
    (async () => {
      const BD = (window as any).BarcodeDetector;
      if (!BD) { setMsg("This phone's browser can't scan yet. Type the 6-letter code instead."); setOn(false); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!alive || !video.current) return;
        video.current.srcObject = stream; await video.current.play();
        const det = new BD({ formats: ["qr_code"] });
        const tick = async () => {
          if (!alive || !video.current) return;
          try {
            const [hit] = await det.detect(video.current);
            const m = hit?.rawValue?.toUpperCase().match(/(?:SKYLAND-PASS:|\/P\/)([A-Z0-9]{6})/);
            if (m) { setOn(false); router.push(`/frontdesk?code=${m[1]}`); return; }
          } catch { /* keep scanning */ }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { setMsg("Camera blocked. Allow camera access, or type the code."); setOn(false); }
    })();
    return () => { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [on, router]);
  return (
    <div style={{ marginTop: 10 }}>
      {on ? <div className="qrscan"><video ref={video} muted playsInline /><button type="button" className="btn sm" onClick={() => setOn(false)}>Stop</button></div>
        : <button type="button" className="btn" onClick={() => { setMsg(null); setOn(true); }}>Scan QR with camera</button>}
      {msg && <div className="hint" style={{ marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
