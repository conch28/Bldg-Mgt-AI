/** Client-side: shrinks a photo before upload (long side `max` px, JPEG at quality `q`). */
export function shrinkImage(src: File | string, max = 720, q = 0.65): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    const revoke = () => { if (typeof src !== "string") URL.revokeObjectURL(url); };
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      revoke();
      resolve(c.toDataURL("image/jpeg", q));
    };
    img.onerror = () => { revoke(); reject(new Error("Could not read that image.")); };
    img.src = url;
  });
}
/** Server-side check for a stored photo: a JPEG/PNG/WebP data URL under ~400 KB. */
export const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const photoOk = (s: string | null | undefined) => !s || (s.length < 560_000 && PHOTO_RE.test(s));
