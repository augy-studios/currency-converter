import { expect, test } from "@playwright/test";
import { rate } from "./fixtures.js";
import { button, calls, converted, fill, history, mockApi, noErrors, noTours, openApp, said, seed, skipTour, stored } from "./helpers.js";

const fmt = (n, d = 6) => Number(n.toFixed(d)).toLocaleString("en-GB", { maximumFractionDigits: d });

test("converts as the site does, and keeps the fields under the site's key", async ({ page }) => {
  await mockApi(page);
  await seed(page, noTours);
  await openApp(page);
  await converted(page);
  await expect(page.getByText(`1 SGD = ${fmt(rate("SGD", "MYR"))} MYR`).first()).toBeVisible();
  // Opening the app remembers nothing.
  expect(await history(page)).toHaveLength(0);

  await fill(page, page.getByRole("textbox").first(), "250");
  await page.keyboard.press("Enter");
  await expect(page.getByText(`${fmt(250 * rate("SGD", "MYR"))} MYR`).first()).toBeVisible();
  await expect.poll(async () => (await history(page)).length).toBe(1);
  expect((await history(page))[0]).toMatchObject({ amount: 250, from: "SGD", to: "MYR", date: "2026-11-13" });
  expect(JSON.parse(await stored(page, "uwuconvert.state"))).toEqual({ amount: "250", from: "SGD — Singapore Dollar", to: "MYR — Malaysian Ringgit" });

  // Pick a currency: a search, then the list.
  await page.getByRole("button", { name: /^To: MYR — Malaysian Ringgit/ }).click();
  await page.keyboard.type("euro");
  await page.getByRole("button", { name: /EUR Euro/ }).click().catch(async () => page.getByText("Euro").first().click());
  await expect(page.getByText(`1 SGD = ${fmt(rate("SGD", "EUR"))} EUR`).first()).toBeVisible();
  await expect.poll(async () => (await history(page)).length).toBe(2);

  // Swap.
  await button(page, "Swap currencies").click();
  await expect(page.getByText(`1 EUR = ${fmt(rate("EUR", "SGD"))} SGD`).first()).toBeVisible();
  // Invert rate turns the line round.
  await button(page, "Invert rate").click();
  await expect(page.getByText(/1 SGD = \d/).first()).toBeVisible();
  noErrors(page);
});

test("History: tap one to convert it again, remove one, clear them", async ({ page }) => {
  await mockApi(page);
  const now = Date.now();
  await seed(page, {
    ...noTours,
    "uwuconvert.history": JSON.stringify([
      { id: "aaaaaaaaaaaa", at: now - 60000, amount: 100, from: "USD", to: "JPY", rate: 150, result: 15000, date: "2026-11-12" },
      { id: "bbbbbbbbbbbb", at: now - 120000, amount: 5, from: "GBP", to: "AUD", rate: 2, result: 10, date: "2026-11-12" },
    ]),
  });
  await openApp(page);
  await converted(page);
  await expect(page.getByText("2 saved on this device")).toBeVisible();
  // History is below the fold: the tray's History brings it into view.
  await button(page, "History of your conversions").click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^100 USD → 15,000 JPY/ }).click();
  // At today's rate, not the one kept.
  await expect(page.getByText(`1 USD = ${fmt(rate("USD", "JPY"))} JPY`).first()).toBeVisible();
  expect(await history(page)).toHaveLength(2);

  // Converting it again brought the converter back into view: History again, for the rest.
  await button(page, "History of your conversions").click();
  await page.waitForTimeout(600);
  await button(page, "Remove 5 GBP → 10 AUD from history").click();
  await expect(page.getByText("1 saved on this device")).toBeVisible();
  await button(page, "Clear").click();
  await button(page, "Clear").last().click();
  await expect(page.getByText("Your conversions will be kept here, on this device only.")).toBeVisible();
  expect(await history(page)).toHaveLength(0);
  noErrors(page);
});

test("offline: the last rates kept, and said so", async ({ page }) => {
  const db = await mockApi(page);
  await seed(page, noTours);
  await openApp(page);
  await converted(page);
  db.offline = true;
  await page.reload();
  await expect(page.getByText(/1 SGD = \d/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Offline: the last rates this device saw.")).toBeVisible();
});

test("Android: words shared from another app fill in the amount and currency; Share uses the share sheet", async ({ page }) => {
  await mockApi(page);
  await seed(page, noTours);
  await openApp(page, "?android=1");
  await converted(page);
  await page.evaluate(() => window.e2eEmit("App", "link", JSON.stringify({ url: "uwu://currency/shared?text=" + encodeURIComponent("That's €12 please") })));
  await expect(said(page, "Detected shared amount")).toBeVisible();
  await expect(page.getByText(`1 EUR = ${fmt(rate("EUR", "MYR"))} MYR`).first()).toBeVisible();
  await expect.poll(async () => (await history(page))[0]).toMatchObject({ amount: 12, from: "EUR", to: "MYR" });

  // The converter's Share (History has one too, for sharing with another device).
  await button(page, "Share").first().click();
  await page.getByRole("button", { name: "Share…" }).click();
  await expect.poll(async () => (await calls(page)).find((c) => c.method === "share")?.options.text).toContain("12 EUR =");
  const share = (await calls(page)).find((c) => c.method === "share");
  // With a picture of the answer.
  expect(share.options.image.length).toBeGreaterThan(1000);
  noErrors(page);
});

test("the graph: ranges, a second currency indexed to 100, and removing it", async ({ page }) => {
  const db = await mockApi(page);
  await seed(page, noTours);
  await openApp(page);
  await converted(page);
  await button(page, "1Y").click();
  await expect.poll(() => db.requests.some((r) => r.path === "/history" && r.query.includes("group=week"))).toBe(true);
  await page.getByRole("button", { name: /Add a currency to compare/ }).click();
  // The field is focused on open, but the browser build only takes keys once its own input has
  // the focus, which a click on the field makes sure of.
  await page.getByRole("textbox", { name: /Search code or name/ }).click();
  await page.keyboard.type("JPY");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Comparing 2+ currencies indexes each to 100 at the start of the range.")).toBeVisible();
  await button(page, "Remove JPY from graph").click();
  await expect(page.getByText("Comparing 2+ currencies indexes each to 100 at the start of the range.")).toHaveCount(0);
  noErrors(page);
});

// The welcome tour on a phone, the first time: each step's target scrolled into view and lit,
// its card on screen; then History's tour, at the bottom of the page.
test("tours stay on screen and scroll to what they show", async ({ page }) => {
  await mockApi(page);
  await openApp(page);
  await converted(page);
  const next = button(page, "Next");
  const done = button(page, "Done");
  await expect(next).toBeVisible({ timeout: 10_000 });
  for (let i = 0; i < 12 && !(await done.isVisible()); i++) {
    const box = await next.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(915);
    await next.click();
    await page.waitForTimeout(400);
  }
  const last = await done.boundingBox();
  expect(last.y + last.height).toBeLessThanOrEqual(915);
  await done.click();
  await expect.poll(() => stored(page, "uwuconvert.tour.welcome")).toBe("done");

  await button(page, "Show me around").click();
  await button(page, "History").click();
  // No history yet: the card itself, then its Share button, each scrolled into view.
  await expect(page.getByText("Your conversions are kept here, on this device only, as you make them.").last()).toBeVisible({ timeout: 8000 });
  let card = await button(page, "Next").boundingBox();
  expect(card.y + card.height).toBeLessThanOrEqual(915);
  await button(page, "Next").click();
  await expect(page.getByText("Share copies your history straight to your other phone or computer, no account needed.").last()).toBeVisible();
  card = await button(page, "Done").boundingBox();
  expect(card.y + card.height).toBeLessThanOrEqual(915);
  await skipTour(page);
  noErrors(page);
});
