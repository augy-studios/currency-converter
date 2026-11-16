import { expect, test } from "@playwright/test";
import { button, calls, converted, mockApi, noErrors, noTours, openApp, seed } from "./helpers.js";

// As announcements/release-notes-<version>.md writes them.
const notes = [
  "Rates for more currencies, and quicker sharing.",
  "",
  "## Download",
  "",
  "| Device | File |",
  "|---|---|",
  "| Android 7.0 or newer | `uwucurrency-1.1.0.apk` |",
  "",
  "## What's new",
  "",
  "### Android app",
  "- **Home screen widget**: a rate on your home screen.",
  "- **Faster sharing**",
  "",
  "### Everywhere",
  "- More currencies to pick from",
].join("\n");

const release = {
  version: "1.1.0",
  apk: "https://github.com/augy-studios/currency-converter/releases/download/android-v1.1.0/uwucurrency-1.1.0.apk",
  size: 41000000,
  sha256: "a".repeat(64),
  page: "https://github.com/augy-studios/currency-converter/releases/tag/android-v1.1.0",
  date: "2026-12-01T10:00:00Z",
  notes,
  history: [
    { version: "1.1.0", date: "2026-12-01T10:00:00Z", notes, page: "https://github.com/augy-studios/currency-converter/releases/tag/android-v1.1.0" },
    { version: "1.0.0", date: "2026-11-16T10:00:00Z", notes: "The Currency Converter is now uwuCurrency.", page: "https://github.com/augy-studios/currency-converter/releases/tag/android-v1.0.0" },
  ],
};

test("a newer version shows a bar; the Updates page lists every version and joins release notifications", async ({ page }) => {
  await mockApi(page, { release });
  await seed(page, noTours);
  await openApp(page, "?android=1&wallpaper=1");
  await converted(page);
  await expect(page.getByText("uwuCurrency 1.1.0 is out.")).toBeVisible();
  await button(page, "Update").click();

  await expect(page.getByRole("group", { name: /^uwuCurrency 1\.1\.0 is out This is version 1\.0\.0\./ })).toBeVisible();
  await expect(page.getByText("Every version")).toBeVisible();
  // The newest, open by itself: its summary, then a card for each group, the Markdown read rather
  // than shown, and the download table left out.
  await expect(page.getByRole("button", { name: /^Version 1\.1\.0 v1\.1\.0 New .*3 changes/ })).toBeVisible();
  await expect(page.getByText("Rates for more currencies, and quicker sharing.")).toBeVisible();
  await expect(page.getByText(/^Android app\s+2\s+Home screen widget\s+A rate on your home screen\.\s+Faster sharing$/)).toBeVisible();
  await expect(page.getByText(/^Everywhere\s+1\s+More currencies to pick from$/)).toBeVisible();
  await expect(page.getByText(/\*\*|\| Device/)).toHaveCount(0);
  // This one, closed till it's pressed.
  const mine = page.getByRole("button", { name: /^Version 1\.0\.0 v1\.0\.0 Installed/ });
  await expect(mine).toBeVisible();
  await expect(page.getByText("The Currency Converter is now uwuCurrency.")).toHaveCount(0);
  await mine.click();
  await expect(page.getByText("The Currency Converter is now uwuCurrency.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Update \(41\.0 MB\)/ })).toBeVisible();

  await page.getByRole("switch", { name: /New versions of the app/ }).click();
  await expect.poll(async () => (await calls(page)).find((c) => c.method === "setReleases")?.options).toEqual({ on: true });
  noErrors(page);
});

test("up to date, the tray's Updates says so and still lists the versions", async ({ page }) => {
  await mockApi(page, { release: { ...release, version: "1.0.0", history: release.history.slice(1) } });
  await seed(page, noTours);
  await openApp(page, "?android=1");
  await converted(page);
  await expect(page.getByText("uwuCurrency 1.1.0 is out.")).toHaveCount(0);
  await button(page, "Updates").click();
  await expect(page.getByRole("group", { name: /^You’re up to date/ })).toBeVisible();
  // Nothing newer: this version's notes open by themselves.
  await expect(page.getByText("The Currency Converter is now uwuCurrency.")).toBeVisible();
  noErrors(page);
});

test("the Play build shows no update bar of its own", async ({ page }) => {
  await mockApi(page, { release });
  await seed(page, noTours);
  await openApp(page, "?android=1&play=1");
  await converted(page);
  await page.waitForTimeout(1500);
  await expect(page.getByText("uwuCurrency 1.1.0 is out.")).toHaveCount(0);
});
