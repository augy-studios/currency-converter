import { expect } from "@playwright/test";
import { CURRENCIES, historyFor, ratesFor } from "./fixtures.js";

export const API = "https://currency.uwuapps.org/api";

/**
 * The site's API, answered here: the rates from fixtures.js, the app's releases from `db.release`,
 * and Report a bug kept in `db.bugReports` (`db.bugStatus` sets its answer). Every request is kept
 * in `db.requests`. `db.offline` makes every rate request fail, as with no network.
 */
export async function mockApi(page, db = {}) {
  db.requests = [];
  db.release ??= { version: null, history: [] };
  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api/, "");
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    db.requests.push({ method: req.method(), path, query: url.search, body });
    const json = (status, data) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(data) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (db.offline && /^\/(currencies|rates|history)$/.test(path)) return route.abort("internetdisconnected");
    switch (path) {
      case "/currencies":
        return json(200, CURRENCIES);
      case "/rates":
        return json(200, ratesFor((url.searchParams.get("base") || "").toUpperCase()));
      case "/history":
        return json(200, historyFor((url.searchParams.get("base") || "").toUpperCase(), (url.searchParams.get("quotes") || "").toUpperCase().split(",").filter(Boolean), url.searchParams.get("from") || "2026-10-13"));
      case "/app-release":
        return json(200, db.release);
      // Report a bug (main-site/api/bug-report.js).
      case "/bug-report":
        (db.bugReports ??= []).push(body);
        if (db.bugStatus && db.bugStatus !== 200) return json(db.bugStatus, { error: "Bug reports can't be sent from the app yet." });
        return json(200, { id: "20261116-7K3Q" });
      default:
        return json(404, { error: "Not found" });
    }
  });
  return db;
}

/** Stored before the app opens, under its keys (store.dart's "ls." prefix, as shared_preferences keeps them in a browser). */
export async function seed(page, values) {
  await page.addInitScript((values) => {
    if (sessionStorage.getItem("e2e-seeded")) return;
    sessionStorage.setItem("e2e-seeded", "1");
    for (const [k, v] of Object.entries(values)) localStorage.setItem(`flutter.ls.${k}`, JSON.stringify(v));
  }, values);
}

/** No tours: the welcome and the others already seen. */
export const noTours = { "uwuconvert.tour.welcome": "done", "uwuconvert.tour.pages": JSON.stringify(["graph", "history"]) };

/** The app, up, with the errors it logs collected. `query` like "?android=1". */
export async function openApp(page, query = "") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource|peerjs|internetdisconnected|ERR_INTERNET/i.test(m.text())) errors.push(m.text());
  });
  await page.goto(`/${query}`);
  page.appErrors = errors;
  return errors;
}

/** The converter's answer, once it's there. */
export async function converted(page) {
  // The answer's lines reach the screen reader as one node, so not anchored at its start.
  await expect(page.getByText(/1 SGD = \d/).first()).toBeVisible({ timeout: 30_000 });
}

export const button = (page, name, exact = true) => page.getByRole("button", { name, exact });

/** What the app keeps, as shared_preferences has it in the browser. */
export const stored = (page, key) =>
  page.evaluate((k) => {
    const v = localStorage.getItem(`flutter.ls.${k}`);
    return v === null ? null : JSON.parse(v);
  }, key);

export const history = async (page) => JSON.parse((await stored(page, "uwuconvert.history")) ?? "[]");

/** What the app asked of its Android side. */
export const calls = (page) => page.evaluate(() => Array.from(window.e2eCalls || []).map((c) => JSON.parse(c)));

/** Types into a text field. */
export async function fill(page, locator, text) {
  await locator.click();
  await page.waitForTimeout(200);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(text);
}

/** A tour on screen goes. */
export async function skipTour(page) {
  const skip = button(page, "Skip");
  try {
    await skip.waitFor({ timeout: 3500 });
    await skip.click();
  } catch {
    // None this time.
  }
}

// "RenderBox was not laid out" from FocusNode.rect, logged when the browser window gains focus as
// the desktop build starts (Flutter sorts the focus tree before its first layout). Logged, not
// thrown at the app; uwuBoard's build, which this one comes from, logs the same.
const KNOWN = /WebSocket|peerjs|broker|RenderBox was not laid out: RenderSemanticsAnnotations|handleViewFocusChanged/i;

export function noErrors(page) {
  expect(page.appErrors.filter((e) => !KNOWN.test(e))).toEqual([]);
}

/** A toast or note: said once to a screen reader and once on screen, so the one on screen. */
export const said = (page, text) => page.getByText(text).last();
