// The update trigger. The browser compares this file byte for byte, so bump
// VERSION on every deploy that changes anything the worker serves (including
// every run of _build/generate.js that is shipped), or nobody is ever offered
// the new version. A new worker installs and then waits; it only takes over
// when somebody presses Reload in the update bar (js/update.js), which posts
// "skip-waiting".
const VERSION = 11;
const CACHE = `currency-docs-v${VERSION}`;
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
  "/js/icons.js",
  "/js/ui.js",
  "/js/theme.js",
  "/js/nav.js",
  "/js/search.js",
  "/js/try-it.js",
  "/js/update.js",
  "/manifest.json",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/404.html"
];
const PRECACHED = new Set(ASSETS);

const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2?family=Jua&family=JetBrains+Mono:wght@400;500&display=swap";

// Set in install, read in activate. A first install has no older version on
// screen to protect, so it claims the open page straight away; that way the
// first visit's font files are cached for offline use. An update never claims
// here: it waits for the Reload button.
let firstInstall = false;

self.addEventListener("install", (event) => {
  firstInstall = !self.registration.active;
  event.waitUntil(
    Promise.all([
      // cache: "reload" so a new version is built from the server, not from
      // HTTP-cached copies of the old one.
      caches.open(CACHE).then((cache) =>
        cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" })))
      ),
      // Google Fonts serves permissive CORS headers on both the stylesheet
      // and the font files, so a plain fetch/add works and yields a normal
      // (non-opaque) cached response - no mode override needed here.
      caches.open(FONT_CACHE).then((cache) => cache.add(GOOGLE_FONTS_CSS).catch(() => {}))
    ])
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE && key !== FONT_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => (firstInstall ? self.clients.claim() : undefined))
  );
});

self.addEventListener("message", (event) => {
  const type = typeof event.data === "string" ? event.data : event.data?.type;

  // The only place skipWaiting is ever called.
  if (type === "skip-waiting") {
    event.waitUntil(self.skipWaiting().then(() => self.clients.claim()));
  }
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

  // The site's own files (every docs page, its .md twin, css, js): served
  // from this version's cache only. They change when the worker does, so
  // revalidating them here would slip new code under a page still running
  // the old version.
  if (url.origin === self.location.origin && PRECACHED.has(url.pathname)) {
    event.respondWith(
      caches.open(CACHE)
        .then((cache) => cache.match(request, { ignoreSearch: true }))
        .then((cached) => {
          // A redirected response cannot answer a navigation, and cleanUrls
          // makes /404.html one.
          if (cached && !(cached.redirected && request.mode === "navigate")) return cached;
          return fetch(request).catch(() =>
            request.mode === "navigate" ? caches.match("/", { cacheName: CACHE }) : undefined
          );
        })
    );
    return;
  }

  // Everything else: stale-while-revalidate, with an offline fallback to the
  // overview page for navigations.
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
