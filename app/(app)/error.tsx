"use client";
import { useEffect } from "react";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/log-error", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: error.message || "Page error", digest: error.digest, path: location.pathname }) }).catch(() => {});
  }, [error]);
  return (
    <main className="view"><div className="card" style={{ maxWidth: 560 }}>
      <h3>That didn&apos;t work</h3>
      <p className="hint">{error.message && !error.message.includes("digest") && !error.digest ? error.message : "Something went wrong on our side. We've been told about it. Please try again."}</p>
      <button className="btn pri" onClick={reset}>Try again</button>
    </div></main>
  );
}
