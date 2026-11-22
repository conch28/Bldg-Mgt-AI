"use client";
export default function PrintButton() {
  return <button type="button" className="btn sm" onClick={() => window.print()}>Print</button>;
}
