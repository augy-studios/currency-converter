const CACHE = "currency-v13";
const FONT_CACHE = "currency-fonts-v2";

const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/CC-main.png",
  "/CC-192.png",
  "/CC-512.png",
  "/favicon.ico",
  "/manifest.json",
  "/404.html",
  "/404.css"
];

const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2?family=Jua&display=swap";

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE).then((cache) => cache.addAll(ASSETS)),
      // Google Fonts serves permissive CORS headers on both the stylesheet
      // and the font files, so a plain fetch/add works and yields a normal
      // (non-opaque) cached response - no mode override needed here.
      caches.open(FONT_CACHE).then((cache) => cache.add(GOOGLE_FONTS_CSS).catch(() => {}))
    ])
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE && key !== FONT_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Google Fonts: cache-first, since the stylesheet/font URLs are effectively
  // immutable (content-hashed) and this keeps the Jua font available offline
  // even after the currency-v* cache gets wiped on an app update. Google
  // serves proper CORS headers here, so this must stay a plain fetch() -
  // wrapping it in mode:"no-cors" produces an opaque response, and Chrome
  // hard-fails a respondWith() that hands an opaque response back for a
  // request whose actual mode isn't "no-cors" (which is exactly how the
  // browser requests cross-origin @font-face files).
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(FONT_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // API calls: network-first, fall back to the last cached response when offline.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Everything else: stale-while-revalidate, with an offline fallback for navigations.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => cached || (request.mode === "navigate" ? caches.match("/index.html") : undefined));
      return cached || fetched;
    })
  );
});
