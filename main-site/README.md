# uwuCurrency: the website

The currency converter at <https://currency.uwuapps.org>, a PWA: plain HTML, CSS and JavaScript
with no build step, and a few Vercel serverless functions. It's the specification the apps in
`../flutter/` follow: the same words, storage keys (`uwuconvert.*` in `localStorage`) and API.

## What's here

```text
index.html, style.css, script.js   the converter, the graph, History and About
js/
  theme.js        seven colours; light, dark or time-based (dark from 18:00 to 09:00)
  tray.js         the edge tray: Theme, History, Share, Show me around, Report a bug
  history.js      conversion history, kept in localStorage (uwuconvert.history)
  sync.js, p2p.js, qr.js   sharing history and the theme with another device: a code or QR code,
                  then WebRTC straight between the two (PeerJS's broker, STUN only)
  tour.js         Show me around, scrolling to each step
  bug-report.js   Report a bug, with Screenshot a page (vendor/html-to-image)
  update.js       the "new version is ready" bar
  icons.js, ui.js
sw.js             the service worker: offline, and its VERSION is what offers an update
privacy.html      the Privacy page (Google Play links to it)
.well-known/assetlinks.json   lets the Android app open this site's links
api/
  currencies.js, rates.js, history.js   the self-hosted Frankfurter API (api.currency.uwuapps.org),
                  proxied with an hour's edge cache, as it sends no CORS headers
  app-release.js  the newest Android release, for the app's updater and Updates page
  push/release.js GitHub's release webhook: "a new version is out" through Firebase
  bug-report.js   Report a bug, sent on to Telegram
  _lib/           shared by the functions (the leading _ keeps Vercel from serving them)
```

## Using it

- Type an amount, pick the two currencies (a code like `USD` or a name like `Euro`), and it
  converts as you type. **Swap** turns it round, **Invert rate** the rate line, **Share** sends it
  to Telegram, X, WhatsApp, Facebook or the device's share sheet, or saves it as a picture.
- **Historical Rates** shows the pair over 5D to Max; add up to six currencies to compare, each
  then indexed to 100 at the start of the range.
- **History** keeps every conversion once it settles: when it's asked for (Convert, Enter, Swap,
  a currency picked), or once the amount's been left alone for a moment. Opening the page and
  refreshing don't add one. Press one to convert it again.
- **Share with another device**: one device shows a code (and a QR code, and a link
  `/#sync/CODE`), the other enters it. Both need the same wifi, or one on the other's hotspot.
  Each side then imports or sends conversions and the theme; copying adds, never deletes.
- Shared text works as a share target: installed as an app, share "50 USD" to it, or open
  `/?text=50%20USD`.

## Running it locally

`vercel dev` in this folder serves the site and its functions. Without the Vercel CLI, any static
server shows the site; its `/api/*` then needs answering some other way (the Playwright suite in
`../flutter/e2e` answers it itself).

## Environment variables

Set these in the Vercel project (Settings → Environment Variables, Production), or in
`.env.local` for `vercel dev`. [.env.example](.env.example) lists them, with what each is for.
**All are optional**: the converter, History and sharing work without any of them.

| Variable | What it does | Set up with |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Sends "uwuCurrency x.y.z is out" to Android phones | [../flutter/FIREBASE-SETUP.md](../flutter/FIREBASE-SETUP.md) |
| `GITHUB_WEBHOOK_SECRET` | Proves the release webhook came from GitHub | the same |
| `GITHUB_TOKEN` | Raises GitHub's limit on the release lookups | the same |
| `BUG_REPORT_BOT_TOKEN`, `BUG_REPORT_CHAT_ID` | Where Report a bug sends reports; without them it offers email | [../BUG-REPORT-SETUP.md](../BUG-REPORT-SETUP.md) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Report a bug's hourly limits (Vercel KV or Upstash Redis) | the same, section 5 |

## Deploying

Deploy this folder as a Vercel project. `vercel.json` sends unknown paths to `404.html`;
`cleanUrls` serves `/privacy` from `privacy.html`.

**Every change to a file the service worker caches** (the HTML, JS, CSS, manifest, icons) must
bump `VERSION` in [sw.js](sw.js) and add any new file to its `ASSETS`. Otherwise anyone who has
the site cached never gets the update.

## Analytics and ads

The site has Google Analytics and Google AdSense (in `index.html` and `privacy.html`'s head). The
apps have neither. The Privacy page says so.

## Special thanks

[Paxriel](https://paxriel.art/) for general coding help, and [Frankfurter](https://frankfurter.dev),
self-hosted, for the rates.

---

[Buy Augy a Coffee](https://donate.stripe.com/28o2akeAr3hv0DK6oo) or [Support Augy Monthly](https://donate.stripe.com/6oEbKUdwn9FTgCI7st)!

Made with 💚 in Singapore by Augy Studios.
