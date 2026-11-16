import { expect, test } from "@playwright/test";
import { button, converted, mockApi, noErrors, noTours, openApp, seed, stored } from "./helpers.js";

test("off Android, the site's look: light, dark and the brand colours, under the site's keys", async ({ page }) => {
  await mockApi(page);
  await seed(page, noTours);
  await openApp(page);
  await converted(page);
  await button(page, "Theme: colour, light or dark").click();
  await expect(page.getByRole("heading", { name: "Theme" })).toBeVisible();
  await button(page, "Dark").click();
  await expect.poll(() => stored(page, "uwuconvert.mode")).toBe("dark");
  await button(page, "Not green 2").click();
  await expect.poll(() => stored(page, "uwuconvert.colorTheme")).toBe("not-green-2");
  await button(page, "Time-based").click();
  await expect(page.getByText(/Following the clock\. Currently (light|dark)\./)).toBeVisible();
  noErrors(page);
});

test("on Android with wallpaper colours, Material You is the default, and the UwU Apps look a switch away", async ({ page }) => {
  await mockApi(page);
  await seed(page, noTours);
  await openApp(page, "?android=1&wallpaper=1");
  await converted(page);
  await button(page, "Theme: colour, light or dark").click();
  await expect(page.getByText("Colours and fonts from your device.")).toBeVisible();
  // Material You has no brand swatches.
  await expect(button(page, "Classic")).toHaveCount(0);
  await button(page, "UwU Apps").click();
  await expect.poll(() => stored(page, "app.look")).toBe("uwuapps");
  await expect(button(page, "Classic")).toBeVisible();
  await button(page, "Material You").click();
  await expect.poll(() => stored(page, "app.look")).toBe("material");
  noErrors(page);
});

// The desktop's second look is its system's glass, in place of Material You.
for (const [kind, label] of [["fluent", "Fluent 2"], ["tahoe", "macOS Tahoe"], ["frosted", "Frosted Glass"]]) {
  test(`on the desktop, the second look is ${label}, not Material You`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await mockApi(page);
    await seed(page, noTours);
    await openApp(page, `?desktop=1&glass=${kind}`);
    await converted(page);
    await button(page, "Theme: colour, light or dark").click();
    await expect(button(page, "Material You")).toHaveCount(0);
    await expect(button(page, label)).toBeVisible();
    // In glass, the colour is the system's accent: no swatches.
    await expect(button(page, "Classic")).toHaveCount(0);
    await button(page, "UwU Apps").click();
    await expect.poll(() => stored(page, "app.look")).toBe("uwuapps");
    await expect(button(page, "Classic")).toBeVisible();
    await button(page, label).click();
    await expect.poll(() => stored(page, "app.look")).toBe("glass");
    noErrors(page);
  });
}
