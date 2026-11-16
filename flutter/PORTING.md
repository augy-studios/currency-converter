# Porting table

Every part of the website (`../main-site/`), the Dart it became, and its state. The site stays
the specification (`docs/flutter-android-app-spec.md` §11): the same words, the same
`localStorage` keys and shapes, the same API.

| The site | The app | State |
|---|---|---|
| `index.html`, `style.css`: the page (converter, graph, History, About) | `lib/app/home.dart` (one column on a phone, the site's grid when wide, two panes on the desktop) | Done |
| `script.js` converter: `codeFromInput`, `convert`, swap, invert, refresh, `uwuconvert.state` | `lib/data/currency.dart`, `lib/app/state.dart`, `lib/features/converter/converter_card.dart` | Done; `test/logic_test.dart` checks the logic |
| The `<datalist>` currency search | `lib/features/converter/currency_picker.dart` (searchCurrencies) | Done |
| `script.js` share menu: device, Telegram, X, WhatsApp, Facebook, Save as Image (html2canvas) | `converter_card.dart` `openShareMenu` (Android's share sheet through the bridge; the desktop copies) | Done |
| `script.js` share target: `parseSharedText`, `?text=` | `currency.dart` `parseSharedText`, `lib/app/links.dart` `LinkShared`, Android's `ACTION_SEND` | Done |
| `script.js` Historical Rates: ranges, chips, indexing to 100, Chart.js | `lib/features/graph/graph_card.dart` (fl_chart), `state.dart` `loadGraph` | Done |
| `js/history.js`: `uwuconvert.history`, record, merge, remove, clear | `lib/data/history.dart`, `lib/features/history/history_card.dart` | Done; same rules, tested on both sides |
| `js/sync.js`, `js/p2p.js`, `js/qr.js`: sharing history and the theme over PeerJS, STUN only | `lib/features/sync/`, `lib/share/` (PeerJS in Dart over flutter_webrtc) | Done; same peer ids and wire, so the app and the site share with each other |
| `js/theme.js`: seven swatches, light, dark, time-based, `uwuconvert.mode` / `.colorTheme` | `lib/theme/theme.dart`, `lib/features/theme/theme_sheet.dart`, plus Material You (Android) and glass (desktop) | Done |
| `js/tray.js`: the edge tray, `uwuconvert.trayOpen` | `lib/app/edge_tray.dart` | Done; the app adds Updates (Android) |
| `js/tour.js`: welcome, graph, history; `uwuconvert.tour.*` | `lib/features/tour/tour.dart` | Done |
| `js/bug-report.js`, `api/bug-report.js` | `lib/features/bug/bug_report.dart`, `lib/app/page_shot.dart` (Screenshot a page) | Done |
| `js/update.js`: the service worker's update bar | `lib/features/update/update_bar.dart` (GitHub Releases; the Updates page) | Done, the app's own way |
| `api/currencies.js`, `api/rates.js`, `api/history.js` | `lib/api/api.dart`, each answer kept for offline | Done |
| `api/app-release.js`, `api/push/release.js` | `update_bar.dart`, Android's `MessagingService.java` | Done |
| Google Analytics, AdSense | Not in the apps, on purpose | — |
