"use client";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="view"><div className="card" style={{ maxWidth: 560 }}>
      <h3>That didn&apos;t work</h3>
      <p className="hint">{error.message && !error.message.includes("digest") ? error.message : "Something went wrong on our side. Please try again."}</p>
      <button className="btn pri" onClick={reset}>Try again</button>
    </div></main>
  );
}
