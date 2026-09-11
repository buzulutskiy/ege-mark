const CACHE = "ege-mark-20260911-081028";
const FILES = ["./", "index.html", "style.css", "app.js", "lesson.js", "cycle.js", "math.js", "ai.js", "book.js", "data.js", "icon.svg", "manifest.webmanifest"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;                 /* GitHub — только по сети */
  e.respondWith(
    fetch(e.request).then(r => {
      const cp = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, cp)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request).then(
      r => r || (e.request.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
