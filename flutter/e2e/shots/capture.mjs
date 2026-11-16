// Takes the pictures the store screenshots are made from (compose.mjs frames them): the app's real
// screens, from the browser build (npm run build), with the same rates and history each time.
//
//     node shots/capture.mjs [phone|tablet7|tablet10|desktop]     pictures land in shots/raw/
//
// It serves the build itself. Four sets: phone (412 × 892 at 3×), 7-inch tablet (600 × 1000 at
// 2.7×), 10-inch tablet (1280 × 800 at 2×) and desktop (1440 × 900 at 2×, with the desktop's
// title bar).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CURRENCIES, historyFor, ratesFor, rate } from "../tests/fixtures.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const OUT = join(here, "raw") + "/";
mkdirSync(OUT, { recursive: true });

// ---- the build, served ----

const root = resolve(here, "../../build/web");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".wasm": "application/wasm", ".png": "image/png", ".ttf": "font/ttf", ".otf": "font/otf" };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^[/\\]+/, "");
  let file = resolve(root, path);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(4297, "127.0.0.1", r));
const BASE = "http://127.0.0.1:4297";

// ---- what's kept ----

const ago = (min) => Date.now() - min * 60000;
const entry = (id, minAgo, amount, from, to) => ({ id, at: ago(minAgo), amount, from, to, rate: rate(from, to), result: amount * rate(from, to), date: "2026-11-13" });
const historyEntries = [
  entry("hist00000001", 2, 100, "SGD", "MYR"),
  entry("hist00000002", 47, 250, "SGD", "JPY"),
  entry("hist00000003", 180, 1200, "MYR", "SGD"),
  entry("hist00000004", 60 * 26, 50, "USD", "EUR"),
  entry("hist00000005", 60 * 30, 15000, "JPY", "SGD"),
  entry("hist00000006", 60 * 52, 80, "GBP", "AUD"),
  entry("hist00000007", 60 * 75, 2000000, "IDR", "SGD"),
];

const release = {
  version: "1.0.0", size: 58153064, sha256: null,
  apk: "https://github.com/augy-studios/currency-converter/releases/download/android-v1.0.0/uwucurrency-1.0.0.apk",
  page: "https://github.com/augy-studios/currency-converter/releases/tag/android-v1.0.0",
  date: new Date().toISOString(),
  history: [
    { version: "1.0.0", date: new Date().toISOString(), page: "https://github.com/augy-studios/currency-converter/releases/tag/android-v1.0.0",
      notes: "The Currency Converter is now uwuCurrency.\n\n## What's new\n\n### Everywhere\n- **History**: every conversion kept on your device.\n- **Share with another device**: with a code, no account needed.\n\n### Android app\n- **Material You by default**, with the UwU Apps look in Theme.\n- **An Updates page** with every version." },
  ],
};

// ---- driving the app ----

async function open(browser, { viewport, scale, query = "", seed = {} }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, hasTouch: viewport.width < 1000, isMobile: viewport.width < 1000 });
  const page = await context.newPage();
  await page.route("https://currency.uwuapps.org/api/**", (route) => {
    const u = new URL(route.request().url());
    const json = (d) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(d) });
    if (u.pathname.endsWith("/currencies")) return json(CURRENCIES);
    if (u.pathname.endsWith("/rates")) return json(ratesFor(u.searchParams.get("base")));
    if (u.pathname.endsWith("/history")) return json(historyFor(u.searchParams.get("base"), u.searchParams.get("quotes").split(","), u.searchParams.get("from")));
    if (u.pathname.endsWith("/app-release")) return json(release);
    return json({ ok: true });
  });
  await page.addInitScript(([h, extra]) => {
    const put = (k, v) => localStorage.setItem(`flutter.ls.${k}`, JSON.stringify(v));
    put("uwuconvert.history", JSON.stringify(h));
    put("uwuconvert.state", JSON.stringify({ amount: "100", from: "SGD — Singapore Dollar", to: "MYR — Malaysian Ringgit" }));
    put("uwuconvert.tour.welcome", "done");
    put("uwuconvert.tour.pages", JSON.stringify(["graph", "history"]));
    put("uwuconvert.trayOpen", "1");
    for (const [k, v] of Object.entries(extra)) put(k, v);
  }, [historyEntries, seed]);
  await page.goto(`${BASE}/${query}`);
  await page.getByText(/1 SGD = \d/).first().waitFor({ timeout: 30_000 }).catch(() => {});
  return { context, page };
}

const btn = (page, name, exact = true) => page.getByRole("button", { name, exact });

async function shot(page, file) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}${file}.png` });
  console.log(file);
}

// Scrolls the page, under the mouse, as a wheel would.
async function scroll(page, dy) {
  const v = page.viewportSize();
  await page.mouse.move(v.width * 0.4, v.height * 0.6);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(600);
}

// On a phone the open tray floats over the page's right edge: tucked away for every picture but
// the first, which points at it.
async function tuck(page) {
  if (page.viewportSize().width >= 500) return;
  await page.getByRole("button", { name: "Hide menu" }).click();
  await page.waitForTimeout(400);
}

async function compare(page, ...codes) {
  for (const code of codes) {
    await page.getByRole("button", { name: /Add a currency to compare/ }).click();
    await page.waitForTimeout(500);
    // Picked from the list, as a finger would: typing in the browser build only reaches a text
    // field the page's own input has focused.
    await page.getByRole("button", { name: new RegExp(`^${code}\\b`) }).last().click();
    await page.waitForTimeout(600);
  }
}

// The eight screens, in the order the store shows them.
async function screens(browser, set, viewport, scale) {
  const q = (s) => `?android=1${s}`;
  const tall = viewport.height > viewport.width;
  let { context, page } = await open(browser, { viewport, scale, query: q("&wallpaper=1"), seed: { "app.look": "uwuapps" } });
  await shot(page, `${set}-01-convert`);
  await tuck(page);

  await btn(page, "1Y").click();
  await compare(page, "USD", "JPY");
  // The graph in view: scrolled to on a tall screen, beside the converter on a wide one.
  // On a tall screen, the page wheeled down in small steps, as far as the graph.
  if (tall) {
    const v = page.viewportSize();
    await page.mouse.move(v.width * 0.4, v.height * 0.5);
    for (let i = 0; i < (v.width < 500 ? 30 : 8); i++) {
      await page.mouse.wheel(0, 160);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(600);
  } else {
    await scroll(page, 560);
  }
  await shot(page, `${set}-02-graph`);

  await page.getByRole("button", { name: "Show menu" }).click().catch(() => {});
  await btn(page, "History of your conversions").click();
  await tuck(page);
  await page.waitForTimeout(900);
  await shot(page, `${set}-03-history`);
  await context.close();

  ({ context, page } = await open(browser, { viewport, scale, query: q("&wallpaper=1"), seed: { "app.look": "material" } }));
  await tuck(page);
  await shot(page, `${set}-04-material-you`);
  await context.close();

  ({ context, page } = await open(browser, { viewport, scale, query: q(""), seed: { "app.look": "uwuapps", "uwuconvert.colorTheme": "not-green-4" } }));
  await btn(page, "Theme: colour, light or dark").click();
  await page.getByRole("heading", { name: "Theme" }).waitFor();
  await shot(page, `${set}-05-theme`);
  await context.close();

  ({ context, page } = await open(browser, { viewport, scale, query: q(""), seed: { "app.look": "uwuapps", "uwuconvert.colorTheme": "not-green-3" } }));
  await btn(page, "Share history with another device").click();
  await btn(page, "Show a code on this device").click();
  await page.waitForTimeout(3000);
  await shot(page, `${set}-06-share`);
  await context.close();

  ({ context, page } = await open(browser, { viewport, scale, query: q("&wallpaper=1"), seed: { "app.look": "material" } }));
  await btn(page, "Updates").click();
  await page.getByText("Every version", { exact: true }).waitFor();
  await shot(page, `${set}-07-updates`);
  await context.close();

  ({ context, page } = await open(browser, { viewport, scale, query: q(""), seed: { "app.look": "uwuapps", "uwuconvert.mode": "dark", "uwuconvert.colorTheme": "not-green-2", "uwuconvert.tour.welcome": "", "uwuconvert.trayOpen": tall && viewport.width < 500 ? "0" : "1" } }));
  await page.getByRole("button", { name: "Skip" }).waitFor({ timeout: 10_000 });
  await btn(page, "Next").click();
  await page.waitForTimeout(500);
  await shot(page, `${set}-08-dark-tour`);
  await context.close();
}

async function desktop(browser) {
  const viewport = { width: 1440, height: 900 };
  const scale = 2;
  const q = "?desktop=1";
  let { context, page } = await open(browser, { viewport, scale, query: q, seed: { "app.look": "uwuapps" } });
  await compare(page, "USD");
  await shot(page, "desktop-01-convert");
  await context.close();

  ({ context, page } = await open(browser, { viewport, scale, query: `${q}&glass=fluent`, seed: {} }));
  await btn(page, "1Y").click();
  await shot(page, "desktop-02-fluent");

  // The command bar: Ctrl+K, then a click on its field so the browser build's input has the focus.
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(500);
  await page.getByRole("textbox", { name: /^Search/ }).click();
  await page.waitForTimeout(400);
  await page.keyboard.type("100 usd to eur", { delay: 30 });
  await page.waitForTimeout(500);
  await shot(page, "desktop-03-command");
  await page.keyboard.press("Escape");
  await context.close();

  ({ context, page } = await open(browser, { viewport, scale, query: `${q}&glass=tahoe`, seed: {} }));
  await compare(page, "EUR", "GBP");
  await shot(page, "desktop-04-tahoe");
  await context.close();

  // History's right-click menu. The screen reader's layer takes a right-click; this one goes to
  // the canvas under it.
  ({ context, page } = await open(browser, { viewport, scale, query: q, seed: { "app.look": "uwuapps", "uwuconvert.colorTheme": "not-green-5" } }));
  const box = await page.getByRole("button", { name: /^250 SGD → / }).boundingBox();
  const pass2 = await page.addStyleTag({ content: "flt-semantics-host, flt-semantics { pointer-events: none !important; }" });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
  await pass2.evaluate((e) => e.remove());
  await page.waitForTimeout(800);
  await shot(page, "desktop-05-menu");
  await page.keyboard.press("Escape");
  await context.close();

  ({ context, page } = await open(browser, { viewport: { width: 940, height: 660 }, scale, query: "?welcome=1", seed: { "uwuconvert.colorTheme": "classic" } }));
  await page.getByText("Get started").waitFor();
  await shot(page, "desktop-06-welcome");
  await context.close();

  ({ context, page } = await open(browser, { viewport, scale, query: `${q}&glass=frosted`, seed: { "uwuconvert.mode": "dark" } }));
  await btn(page, "5Y").click();
  await shot(page, "desktop-07-frosted");
  await context.close();

  ({ context, page } = await open(browser, { viewport, scale, query: q, seed: { "app.look": "uwuapps", "uwuconvert.colorTheme": "not-green-1" } }));
  await btn(page, "Share history with another device").click();
  await btn(page, "Show a code on this device").click();
  await page.waitForTimeout(3000);
  await shot(page, "desktop-08-share");
  await context.close();
}

const browser = await chromium.launch();
const only = process.argv[2];
try {
  if (!only || only === "phone") await screens(browser, "phone", { width: 412, height: 892 }, 3);
  if (!only || only === "tablet7") await screens(browser, "tablet7", { width: 600, height: 1000 }, 2.7);
  if (!only || only === "tablet10") await screens(browser, "tablet10", { width: 1280, height: 800 }, 2);
  if (!only || only === "desktop") await desktop(browser);
} finally {
  await browser.close();
  server.close();
}
