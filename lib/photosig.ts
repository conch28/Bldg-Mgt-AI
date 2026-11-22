/**
 * Photo fingerprints, so the app can notice a reused or near-identical proof photo.
 * A signature is "sha:dhash": the first 16 hex chars of a SHA-256 of the image bytes (exact copies),
 * plus a 64-bit difference hash of the picture (the same shot re-saved, cropped a little or brightened).
 * The dhash is only computed for JPEGs, which is what phones upload through PhotoField.
 */
import { createHash } from "node:crypto";
import jpeg from "jpeg-js";

const DATA_RE = /^data:(image\/[a-z+]+);base64,(.+)$/;

/** Difference hash: shrink to 9x8 grey, then one bit per pixel: is it brighter than its right neighbour? */
function dhash(rgba: Uint8Array, w: number, h: number): string {
  const W = 9, Hh = 8, grey: number[] = [];
  for (let y = 0; y < Hh; y++) {
    const y0 = Math.floor((y * h) / Hh), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / Hh));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor((x * w) / W), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / W));
      let sum = 0, n = 0;
      // sample every other pixel; plenty for an 8x8 hash and twice as fast
      for (let yy = y0; yy < y1; yy += 2) for (let xx = x0; xx < x1; xx += 2) {
        const i = (yy * w + xx) * 4;
        sum += rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114; n++;
      }
      grey.push(n ? sum / n : 0);
    }
  }
  let bits = "";
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W - 1; x++) bits += grey[y * W + x] > grey[y * W + x + 1] ? "1" : "0";
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Signature of a data-URL photo, or null if it isn't one. Never throws. */
export function photoSig(dataUrl: string | null | undefined): string | null {
  const m = dataUrl?.match(DATA_RE);
  if (!m) return null;
  const bytes = Buffer.from(m[2], "base64");
  const sha = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  let dh = "";
  if (m[1] === "image/jpeg") {
    try {
      const img = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 12, maxMemoryUsageInMB: 256 });
      dh = dhash(img.data, img.width, img.height);
    } catch { /* unreadable JPEG: exact-copy check still works */ }
  }
  return `${sha}:${dh}`;
}

export const sigParts = (sig: string) => { const [sha, dh] = sig.split(":"); return { sha, dh: dh || null }; };

/** Number of differing bits between two dhashes (0 = same picture, 64 = opposite). */
export function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

/** Same bytes = 0; near-identical picture = small distance; unrelated or not comparable = null. */
export function photoDistance(a: string, b: string): number | null {
  const A = sigParts(a), B = sigParts(b);
  if (A.sha === B.sha) return 0;
  if (!A.dh || !B.dh) return null;
  return hamming(A.dh, B.dh);
}
