// The update trigger. The browser compares this file byte for byte, so bump
// VERSION on every deploy that changes anything the worker serves, or nobody
// is ever offered the new version. A new worker installs and then waits; it
// only takes over when somebody presses Reload in the update bar
// (js/update.js), which posts "skip-waiting".
const VERSION = 17;
const CACHE = `currency-v${VERSION}`;
const FONT_CACHE = "currency-fonts-v2";

const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/js/icons.js",
  "/js/ui.js",
  "/js/theme.js",
  "/js/update.js",
  "/js/tray.js",
  "/js/qr.js",
  "/js/p2p.js",
  "/js/history.js",
  "/js/sync.js",
  "/js/tour.js",
  "/js/bug-report.js",
  "/privacy",
  "/privacy.css",
  "/CC-main.png",
  "/CC-192.png",
  "/CC-512.png",
  "/favicon.ico",
  "/manifest.json",
  "/404.html",
  "/404.css"
];
const PRECACHED = new Set(ASSETS);

const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2?family=Jua&display=swap";

// Set in install, read in activate. A first install has no older version on
// screen to protect, so it claims the open page straight away; that way the
// first visit's rates, CDN scripts and font files are cached for offline use.
// An update never claims here: it waits for the Reload button.
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

  // Report a bug asks which version is serving the page (js/bug-report.js).
  if (type === "version" && event.ports?.[0]) {
    event.ports[0].postMessage(`v${VERSION}`);
    return;
  }

  // The only place skipWaiting is ever called.
  if (type === "skip-waiting") {
    event.waitUntil(self.skipWaiting().then(() => self.clients.claim()));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only GETs are cached: a bug report or anything else sent goes straight to the network.
  if (request.method !== "GET") return;

  // Pairing for Sync (js/p2p.js) needs the network anyway, and an old signalling client or a
  // cached answer from the broker (a peer id handed out twice) is worse than a clear "could not
  // load" (docs/STUN-p2p-spec.md, "PWA integration").
  if (url.hostname.endsWith("peerjs.com") || url.pathname.includes("/peerjs/")) return;

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

  // The site's own files: served from this version's cache only. They change
  // when the worker does, so revalidating them here would slip new code under
  // a page still running the old version. Query strings are ignored so a
  // shared link like /?from=SGD&to=MYR still opens offline.
  if (url.origin === self.location.origin && PRECACHED.has(url.pathname)) {
    event.respondWith(
      caches.open(CACHE)
        .then((cache) => cache.match(request, { ignoreSearch: true }))
        .then((cached) => {
          // A redirected response cannot answer a navigation, and cleanUrls
          // makes /index.html one.
          if (cached && !(cached.redirected && request.mode === "navigate")) return cached;
          return fetch(request).catch(() =>
            request.mode === "navigate" ? caches.match("/", { cacheName: CACHE }) : undefined
          );
        })
    );
    return;
  }

  // Everything else: stale-while-revalidate, with an offline fallback for
  // navigations. "/" rather than "/index.html", which Vercel's cleanUrls
  // redirects, and a redirected response cannot answer a navigation.
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
