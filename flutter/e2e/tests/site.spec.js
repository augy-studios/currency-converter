import { expect, test } from "@playwright/test";
import { rate, routeApi } from "./fixtures.js";

// The website itself (main-site/), served by site-serve.mjs with /api answered here: conversion
// history, sharing it between two browsers over PeerJS, the tours, Report a bug and Privacy.
const SITE = "http://127.0.0.1:4292";

async function open(page, path = "/", { tours = false, init } = {}) {
  await page.context().route(/googletagmanager|google-analytics|doubleclick|googlesyndication/, (r) => r.abort());
  await routeApi(page.context());
  await page.addInitScript(({ tours, init }) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    if (!tours) {
      localStorage.setItem("uwuconvert.tour.welcome", "done");
      localStorage.setItem("uwuconvert.tour.pages", JSON.stringify(["graph", "history"]));
    }
    for (const [k, v] of Object.entries(init || {})) localStorage.setItem(k, v);
  }, { tours, init });
  await page.goto(`${SITE}${path}`);
  await expect(page.locator("body.app-ready")).toHaveCount(1);
}

const history = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("uwuconvert.history") || "[]"));

test("history: kept when a conversion settles, not on opening the page", async ({ page }) => {
  await open(page);
  await expect(page.locator("#to-code")).toHaveText("MYR");
  // Opening the page converts, but remembers nothing.
  expect(await history(page)).toHaveLength(0);
  await expect(page.locator("#historyEmpty")).toBeVisible();

  // Convert, pressed: straight away.
  await page.locator("#amount").fill("100");
  await page.getByRole("button", { name: "Convert", exact: true }).click();
  await expect(page.locator("#historyList .historyItem")).toHaveCount(1);
  let list = await history(page);
  expect(list[0]).toMatchObject({ amount: 100, from: "SGD", to: "MYR", rate: rate("SGD", "MYR"), date: "2026-11-13" });
  expect(list[0].result).toBeCloseTo(100 * rate("SGD", "MYR"), 6);

  // Typing: once it's been left alone. 1, 10, 100 on the way to 250 don't each count, and the
  // same pair a moment later replaces the entry rather than adding one.
  await page.locator("#amount").fill("");
  await page.locator("#amount").pressSequentially("250", { delay: 60 });
  await page.waitForTimeout(2200);
  list = await history(page);
  expect(list).toHaveLength(1);
  expect(list[0].amount).toBe(250);

  // Swap: a new pair, a new entry.
  await page.getByRole("button", { name: "Swap currencies" }).click();
  await expect(page.locator("#historyList .historyItem")).toHaveCount(2);
  list = await history(page);
  expect(list[0]).toMatchObject({ from: "MYR", to: "SGD" });

  // Pressing one converts it again, without adding another.
  await page.locator("#historyList .historyOpen").nth(1).click();
  await expect(page.locator("#from")).toHaveValue(/^SGD/);
  await expect(page.locator("#to")).toHaveValue(/^MYR/);
  expect(await history(page)).toHaveLength(2);

  // Remove one, then clear the rest.
  await page.locator("#historyList .historyDelete").first().click();
  await expect(page.locator("#historyList .historyItem")).toHaveCount(1);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator("#historyList .historyItem")).toHaveCount(0);
  await expect(page.locator("#historyEmpty")).toBeVisible();
});

test("history: what another device sends is checked field by field", async ({ page }) => {
  await open(page);
  const out = await page.evaluate(() => ConvHistory.clean([
    { id: "aaaaaaaaaaaa", at: 1763280000000, amount: 5, from: "SGD", to: "USD", rate: 0.77, result: 3.85, date: "2026-11-13" },
    { id: "aaaaaaaaaaaa", at: 1763280000001, amount: 6, from: "SGD", to: "USD", rate: 0.77 },
    { id: "<script>", at: 1, amount: 1, from: "SGD", to: "USD", rate: 1 },
    { id: "bbbbbbbbbbbb", at: 1763280000000, amount: -1, from: "SGD", to: "USD", rate: 1 },
    { id: "cccccccccccc", at: 1763280000000, amount: 1, from: "sgd<b>", to: "USD", rate: 1 },
    { id: "dddddddddddd", at: 1763290000000, amount: 2, from: "EUR", to: "JPY", rate: 179.3, date: "not a date" },
    "nonsense",
  ]));
  expect(out).toHaveLength(2);
  expect(out[0]).toMatchObject({ id: "dddddddddddd", date: "", result: 2 * 179.3 });
  expect(out[1].id).toBe("aaaaaaaaaaaa");
  expect(await page.evaluate(() => ConvHistory.clean("no"))).toBeNull();
});

// Two browsers on this computer: one shows a code, the other enters it, and the history goes
// across over WebRTC (PeerJS's public broker, STUN only). Needs the internet for the broker.
test("sharing history with another device, both ways, and the theme", async ({ browser }) => {
  const seed = (id, at, amount, from, to) => ({ id, at, amount, from, to, rate: rate(from, to), result: amount * rate(from, to), date: "2026-11-13" });
  const a = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const b = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const pa = await a.newPage();
  const pb = await b.newPage();
  await open(pa, "/", { init: { "uwuconvert.history": JSON.stringify([seed("hostEntry0001", 1763280000000, 10, "SGD", "USD")]) } });
  await open(pb, "/", {
    init: {
      "uwuconvert.history": JSON.stringify([seed("guestEntry001", 1763290000000, 20, "EUR", "JPY"), seed("guestEntry002", 1763270000000, 30, "GBP", "AUD")]),
      "uwuconvert.mode": "dark",
    },
  });

  await pa.getByRole("button", { name: "Share history with another device" }).click();
  await pa.getByRole("button", { name: "Show a code on this device" }).click();
  const code = pa.locator("#syncCode");
  await expect(code).toHaveText(/^[A-Z0-9]{6}$/, { timeout: 20_000 });
  await expect(pa.locator("#syncQr svg")).toBeVisible();
  let reachable = true;
  try {
    await expect(pa.locator("#syncStatusText")).toHaveText(/Waiting for the other device/, { timeout: 20_000 });
  } catch {
    reachable = false;
  }
  test.skip(!reachable, "PeerJS's broker isn't reachable from here");

  await pb.locator("#historySync").click();
  await pb.locator("#syncCodeInput").fill((await code.textContent()).toLowerCase());
  await pb.getByRole("button", { name: "Connect" }).click();
  await expect(pb.locator("#syncStatusText")).toHaveText("Connected to the other device.", { timeout: 30_000 });
  await expect(pa.locator("#syncStatusText")).toHaveText("Connected to the other device.", { timeout: 30_000 });

  // B imports A's one conversion.
  await expect(pb.locator("#syncList .syncItem")).toHaveCount(1);
  await expect(pb.locator("#syncList")).toContainText("10 SGD →");
  await pb.locator("#syncAll").check();
  await pb.getByRole("button", { name: "Import 1 thing to this device" }).click();
  await expect(pb.locator("#syncNote")).toHaveText("Imported 1 thing to this device.");
  expect((await history(pb)).map((e) => e.id)).toEqual(["guestEntry001", "hostEntry0001", "guestEntry002"]);

  // B sends its two, and its dark mode, to A.
  await pb.getByRole("tab", { name: "Send" }).click();
  await expect(pb.locator("#syncList .syncItem:not(.done)")).toHaveCount(3);
  await pb.locator("#syncAll").check();
  await pb.getByRole("button", { name: "Send 3 things to the other device" }).click();
  await expect(pb.locator("#syncNote")).toHaveText("Sent. The other device took 3 new things.", { timeout: 10_000 });
  expect((await history(pa)).map((e) => e.id)).toEqual(["guestEntry001", "hostEntry0001", "guestEntry002"]);
  await expect(pa.locator("html")).toHaveAttribute("data-mode", "dark");
  await expect(pa.locator("#historyList .historyItem")).toHaveCount(3);

  // Disconnecting on purpose retires the host's code.
  const old = await code.textContent();
  await pb.getByRole("button", { name: "Disconnect" }).click();
  await expect(pa.locator("#syncCode")).not.toHaveText(old, { timeout: 20_000 });
  await a.close();
  await b.close();
});

// The welcome tour, on a phone: each step's element scrolled to, wherever on the page it is, lit,
// with its card on screen and the element on screen too.
test("tours scroll to each step and keep their card on screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await open(page, "/", { tours: true });
  const card = page.locator(".tourCard");
  await expect(card).toBeVisible({ timeout: 8000 });
  const steps = ["#amount", "#from", "#swap", "#to", ".result", "#trayButtons"];
  const check = async (target) => {
    await page.waitForTimeout(500);
    const vh = 700;
    const c = await card.boundingBox();
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.y + c.height).toBeLessThanOrEqual(vh);
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(390);
    const el = await page.locator(target).first().boundingBox();
    expect(el.y).toBeLessThan(vh);
    expect(el.y + el.height).toBeGreaterThan(0);
  };
  for (let i = 0; i < steps.length; i++) {
    await check(steps[i]);
    await page.getByRole("button", { name: i === steps.length - 1 ? "Done" : "Next" }).click();
  }
  await expect(card).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("uwuconvert.tour.welcome"))).toBe("done");

  // History is at the bottom of the page: its tour scrolls down to it.
  await page.getByRole("button", { name: "Show me around" }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(card).toBeVisible();
  await check("#historyCard");
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(300);
  // Scrolling while it's up keeps the card on screen and the light on its element.
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(300);
  const c = await card.boundingBox();
  expect(c.y).toBeGreaterThanOrEqual(0);
  expect(c.y + c.height).toBeLessThanOrEqual(700);
});

test("Report a bug: Screenshot a page takes the whole page, sent with its ID", async ({ page }) => {
  const sent = [];
  await page.route("**/api/bug-report", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "20261116-7K3Q" }) });
  });
  await open(page);
  await page.getByRole("button", { name: "Report a bug" }).click();
  await expect(page.locator("#bugDetails")).toContainText("Converter");
  await page.locator("#bugText").fill("The graph is blank on Sundays");
  await page.getByRole("button", { name: "Screenshot a page" }).click();
  await expect(page.locator("#bugShotBar")).toBeVisible();
  await page.getByRole("button", { name: "Screenshot this page" }).click();
  await expect(page.locator("#bugShots img")).toHaveCount(1, { timeout: 20_000 });
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("#bugStatus")).toContainText("20261116-7K3Q");
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ text: "The graph is blank on Sundays", platform: "web" });
  expect(sent[0].images).toHaveLength(1);
  expect(sent[0].images[0]).toMatch(/^data:image\/jpeg;base64,/);
  // The page is taller than the window, so it's sent whole, as a file too.
  expect(sent[0].full).toEqual([0]);
});

test("Privacy: linked from the page, and says what stays on the device", async ({ page }) => {
  await open(page);
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  for (const h of ["What stays on your device", "Sharing history with another device", "Report a bug", "The website"]) {
    await expect(page.getByRole("heading", { name: new RegExp(h) })).toBeVisible();
  }
  await expect(page.getByText(/There are no ads in\s+the apps/)).toBeVisible();
});

test("the edge tray: tucked away and back, remembered", async ({ page }) => {
  await open(page);
  await expect(page.locator("#trayButtons")).not.toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Hide menu" }).click();
  await expect(page.locator("#trayButtons")).toHaveAttribute("inert", "");
  await page.reload();
  await expect(page.locator("#trayButtons")).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Show menu" }).click();
  await page.getByRole("button", { name: "History of your conversions" }).click();
  await expect(page.locator("#historyCard")).toBeInViewport();
});

test("the edge tray: API Docs opens the documentation site in a new tab", async ({ page }) => {
  await open(page);
  const link = page.locator("#trayButtons").getByRole("link", { name: "API Docs" });
  await expect(link).toHaveAttribute("href", "https://docs.api.currency.uwuapps.org/");
  await expect(link).toHaveAttribute("target", "_blank");
});
