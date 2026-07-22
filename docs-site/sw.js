const CACHE = "currency-docs-v8";
const FONT_CACHE = "currency-docs-fonts-v2";

const ASSETS = [
  "/",
  "/quickstart",
  "/rates-latest",
  "/rates-historical",
  "/rates-timeseries",
  "/single-pair",
  "/conversion",
  "/currencies",
  "/providers",
  "/charting",
  "/output-formats",
  "/errors",
  "/faq",
  "/llms.txt",
  "/index.md",
  "/quickstart.md",
  "/rates-latest.md",
  "/rates-historical.md",
  "/rates-timeseries.md",
  "/single-pair.md",
  "/conversion.md",
  "/currencies.md",
  "/providers.md",
  "/charting.md",
  "/output-formats.md",
  "/errors.md",
  "/faq.md",
  "/css/theme.css",
  "/css/docs.css",
  "/js/nav-data.js",
  "/js/theme.js",
  "/js/nav.js",
  "/js/search.js",
  "/js/try-it.js",
  "/manifest.json",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/404.html"
];

const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2?family=Jua&family=JetBrains+Mono:wght@400;500&display=swap";

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

  // Google Fonts: cache-first, content-hashed URLs so this is effectively
  // immutable. Google serves proper CORS headers here, so this must stay a
  // plain fetch() - wrapping it in mode:"no-cors" produces an opaque
  // response, and Chrome hard-fails a respondWith() that hands an opaque
  // response back for a request whose actual mode isn't "no-cors" (which
  // is exactly how the browser requests cross-origin @font-face files).
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

  // The live API itself: never cache, this is reference docs, not the API.
  if (url.hostname === "api.currency.uwuapps.org") return;

  // Everything else (docs pages, css, js): stale-while-revalidate, with an
  // offline fallback to the last cached page for navigations.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => cached || (request.mode === "navigate" ? caches.match("/") : undefined));
      return cached || fetched;
    })
  );
});
