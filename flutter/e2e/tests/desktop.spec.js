import { expect, test } from "@playwright/test";
import { rate } from "./fixtures.js";
import { button, converted, history, mockApi, noErrors, noTours, openApp, seed } from "./helpers.js";

const fmt = (n, d = 6) => Number(n.toFixed(d)).toLocaleString("en-GB", { maximumFractionDigits: d });

test.use({ viewport: { width: 1366, height: 860 } });

test("the desktop: two panes, the command bar converts a sentence, History's right-click menu", async ({ page }) => {
  await mockApi(page);
  await seed(page, noTours);
  await openApp(page, "?desktop=1");
  await converted(page);
  // The converter and the graph side by side.
  const conv = await page.getByText("Currency Converter").first().boundingBox();
  const graph = await page.getByText("Historical Rates").boundingBox();
  expect(graph.x).toBeGreaterThan(conv.x + 300);
  expect(Math.abs(graph.y - conv.y)).toBeLessThan(40);

  // Ctrl+K, then a sentence. In the browser build, typing reaches the field once the page's own
  // input has the focus, which a click on it gives (as uwuHere's suite does).
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(500);
  await page.getByRole("textbox", { name: /^Search/ }).click();
  await page.waitForTimeout(400);
  await page.keyboard.type("50 usd to jpy", { delay: 30 });
  await expect(page.getByText("Convert 50 USD to JPY")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText(`1 USD = ${fmt(rate("USD", "JPY"))} JPY`).first()).toBeVisible();
  await expect.poll(async () => (await history(page))[0]).toMatchObject({ amount: 50, from: "USD", to: "JPY" });

  // Right-click a conversion: the desktop's own actions.
  await page.getByRole("button", { name: /^50 USD → / }).click({ button: "right" });
  for (const item of ["Convert again", "Pin to Desktop Widget", "Set as Tray Rate", "Copy Link", "Remove"]) {
    await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  noErrors(page);
});
