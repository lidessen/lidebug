import { expect } from "@playwright/test";
import { test } from "../test.ts";

test.use({
  plugins: [],
});

test.beforeEach(async ({ xiaoxitian }) => {
  xiaoxitian.mock("https://mock.xiaoxitian.com/", {
    status: 200,
    contentType: "text/html",
    body: "<html><head></head><body>Xiaoxitian</body></html>",
  });
});

test("mock", async ({ page }) => {
  await page.goto("https://mock.xiaoxitian.com/");
  expect(await page.content()).toBe(
    "<html><head></head><body>Xiaoxitian</body></html>"
  );
});
