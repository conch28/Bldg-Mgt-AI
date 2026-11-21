// Skyland service worker: installable app, fast repeat loads, and a friendly offline page.
// Pages are always fetched fresh (they hold live account data); only static build files are cached.
const CACHE = "skyland-v3";
const OFFLINE = "/offline.html";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"]))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  if (url.origin !== location.origin) return;
  if (r.mode === "navigate") { e.respondWith(fetch(r).catch(() => caches.match(OFFLINE))); return; }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); return res; })));
  }
});
