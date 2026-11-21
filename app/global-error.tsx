"use client";
import { useEffect } from "react";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/log-error", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: error.message || "App crash", digest: error.digest, path: location.pathname }) }).catch(() => {});
  }, [error]);
  return (<html lang="en"><body style={{ fontFamily: "system-ui", padding: 24 }}><h2>Something went wrong</h2><p>We&apos;ve been told about it. Please try again.</p><button onClick={reset}>Try again</button></body></html>);
}
