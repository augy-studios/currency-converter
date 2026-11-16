import { expect, test } from "@playwright/test";
import { button, converted, fill, mockApi, noErrors, noTours, openApp, said, seed, stored } from "./helpers.js";

// History with these conversions, past the tours. Their amounts must never be sent.
async function withHistory(page, entries, query = "") {
  const now = Date.now();
  await seed(page, {
    ...noTours,
    "uwuconvert.history": JSON.stringify(entries.map(([amount, from, to, rate], i) => ({
      id: `entry${String(i).padStart(7, "0")}`, at: now - i * 60000, amount, from, to, rate, result: amount * rate, date: "2026-11-13",
    }))),
  });
  await openApp(page, query);
  await converted(page);
}

// What's in the report's "What went wrong?" box, found by its name, which it keeps once filled
// in. The web build gives a text box its value only while it's focused, so it's focused first.
async function expectTyped(page, text) {
  const box = page.getByRole("textbox", { name: /What went wrong/ });
  await box.click();
  await expect(box).toHaveValue(text);
}

// Report a bug (lib/features/bug/bug_report.dart), as the site's form (main-site/js/bug-report.js).
test("Report a bug: what it adds, Screenshot a page with a window open, sent with its ID", async ({ page }) => {
  const db = await mockApi(page);
  await withHistory(page, [[98765.43, "SGD", "MYR", 3.269231]], "?android=1");
  await button(page, "Report a bug").click();
  await expect(page.getByRole("heading", { name: "Report a bug" })).toBeVisible();
  const details = page.getByText(/^Sent with it, to help find the bug:/);
  await expect(details).toContainText("Android app");
  await expect(details).toContainText("Converter");
  await expect(details).not.toContainText("98765");

  // Nothing typed: asks first, sends nothing.
  await button(page, "Send").click();
  await expect(said(page, "Please say what went wrong first.")).toBeVisible();
  expect(db.bugReports ?? []).toHaveLength(0);

  await fill(page, page.getByRole("textbox", { name: /What went wrong/ }), "The rate looks a day old.");
  await expect.poll(async () => JSON.parse((await stored(page, "uwuconvert.bugDraft")) ?? "{}").text).toBe("The rate looks a day old.");

  // Screenshot a page: the report goes, the bar comes, off to the Theme window.
  await button(page, "Screenshot a page").click();
  await expect(page.getByRole("heading", { name: "Report a bug" })).toHaveCount(0);
  await expect(button(page, "Screenshot this page")).toBeVisible();
  await button(page, "Theme: colour, light or dark").click();
  await expect(page.getByRole("heading", { name: "Theme" })).toBeVisible();
  await button(page, "Screenshot this page").click();

  // Back, with the picture and what was typed, over the Theme window.
  await expect(page.getByRole("heading", { name: "Report a bug" })).toBeVisible({ timeout: 20_000 });
  await expect(button(page, "Screenshot this page")).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Picture 1" })).toBeVisible();
  await expectTyped(page, "The rate looks a day old.");
  await expect(details).toContainText("Converter, Theme");

  await button(page, "Send").click();
  await expect(said(page, "Sent as report 20261116-7K3Q. Thank you! Augy will look into it.")).toBeVisible();
  const sent = db.bugReports.at(-1);
  expect(sent.text).toBe("The rate looks a day old.");
  expect(sent.platform).toBe("android");
  expect(sent.page).toBe("Converter, Theme");
  expect(sent.images).toHaveLength(1);
  expect(sent.images[0]).toMatch(/^data:image\/jpeg;base64,/);
  expect(sent.full).toEqual([]);
  expect(Object.keys(sent).sort()).toEqual(["contact", "device", "full", "images", "page", "platform", "text", "version", "website"]);
  expect(JSON.stringify(sent)).not.toContain("98765");
  // Cleared once sent.
  await expect(page.getByRole("img", { name: "Picture 1" })).toHaveCount(0);
  expect(await stored(page, "uwuconvert.bugDraft")).toBeNull();
  noErrors(page);
});

test("Report a bug: Screenshot a page takes the whole page; not set up offers email", async ({ page }) => {
  const db = await mockApi(page);
  // Enough history that the page is much taller than the screen.
  await withHistory(page, Array.from({ length: 30 }, (_, i) => [i + 1, "USD", "JPY", 154.2]));
  await page.getByRole("button", { name: "Show all 30" }).waitFor({ timeout: 10_000 }).catch(() => {});
  await button(page, "Report a bug").click();
  await fill(page, page.getByRole("textbox", { name: /What went wrong/ }), "The whole page, please.");
  await button(page, "Screenshot a page").click();
  await button(page, "Screenshot this page").click();
  await expect(page.getByRole("img", { name: "Picture 1" })).toBeVisible({ timeout: 20_000 });

  db.bugStatus = 503;
  await button(page, "Send").click();
  await expect(said(page, "Bug reports can’t be sent from the app yet.")).toBeVisible();
  await expect(button(page, "Email it instead.")).toBeVisible();
  const sent = db.bugReports.at(-1);
  expect(sent.full).toEqual([0]);
  expect(sent.platform).toBe("web");
  // The whole page, taller than the screen, within what Telegram takes as a photo.
  const size = await page.evaluate(async (src) => {
    const i = new Image();
    i.src = src;
    await i.decode();
    return [i.naturalWidth, i.naturalHeight];
  }, sent.images[0]);
  expect(size[1]).toBeGreaterThan(915);
  expect(size[0] + size[1]).toBeLessThanOrEqual(10000);
  expect(sent.images[0].length * 0.75).toBeLessThanOrEqual(900 * 1024 + 4);
  // What's typed stays when it couldn't go.
  await expectTyped(page, "The whole page, please.");
  noErrors(page);
});
