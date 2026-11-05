import { test, expect } from "@playwright/test";

const searchFixture = {
  query: "e2e fixture",
  notice:
    "Deterministic E2E search fixture; no paid retailer request was made.",
  amazon: [
    {
      id: "amazon-headphones",
      title: "E2E Wireless Headphones - Amazon",
      price_cents: 5499,
      currency: "USD",
      rating: 4.6,
      link: "https://example.com/amazon-headphones",
      thumbnail: null,
      sponsored: false
    }
  ],
  walmart: [
    {
      id: "walmart-headphones",
      title: "E2E Wireless Headphones - Walmart",
      price_cents: 4999,
      currency: "USD",
      rating: 4.5,
      link: "https://example.com/walmart-headphones",
      thumbnail: null,
      sponsored: false
    }
  ]
};

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.abort()
  );

  await page.route("**/api/live-search**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
        "Access-Control-Allow-Credentials": "true"
      },
      body: JSON.stringify(searchFixture)
    });
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Search once. See both prices." })
  ).toBeVisible();
});

test("searches, filters, and adds a listing to the basket", async ({
  page
}) => {
  await page.locator('[data-view="search"]').click();

  const searchForm = page.locator("form.search");
  await searchForm
    .getByRole("textbox", { name: "Search products" })
    .fill("wireless headphones");
  await searchForm.getByRole("button", { name: "Search" }).click();

  await expect(page.locator(".card")).toHaveCount(2);
  await page.locator('[data-retailer="Walmart"]').click();
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".card").first()).toContainText("Walmart");

  await page
    .locator(".card")
    .first()
    .getByRole("button", { name: "Add to basket" })
    .click();

  await expect(page.locator("#basket-count")).toHaveText("1");
  await page.locator("#basket-button").click();
  await expect(page.locator("#basket-window")).toBeVisible();
  await expect(page.locator("#basket-sub")).toHaveText("1 item");
  await expect(page.locator("#basket-summary")).toContainText("Total");
});

test("creates an account and manages a database-backed wishlist", async ({
  page
}, testInfo) => {
  const project = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-");
  const email = `e2e-${project}-${Date.now()}@example.com`;

  await page.locator("#who").click();
  await page.locator("#tab-up").click();
  await page.locator("#name").fill("E2E Tester");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("E2E-password-123!");
  await page.locator("#submit").click();

  await expect(page.locator("#auth-window")).not.toBeVisible();
  await expect(page.locator("#who")).toHaveAttribute(
    "aria-label",
    "Your profile, E2E"
  );

  await page.locator('[data-view="search"]').click();
  const searchForm = page.locator("form.search");
  await searchForm
    .getByRole("textbox", { name: "Search products" })
    .fill("wireless headphones");
  await searchForm.getByRole("button", { name: "Search" }).click();

  const amazonCard = page.locator(".card").filter({
    hasText: "E2E Wireless Headphones - Amazon"
  });
  await amazonCard.getByRole("button", { name: "Save to wishlist" }).click();
  await expect(page.locator("#toasts")).toContainText("Saved to your account");

  await page.locator('[data-view="profile"]').click();
  await expect(
    page.getByRole("heading", { name: "Wishlist", exact: true })
  ).toBeVisible();
  await expect(page.locator(".card")).toContainText(
    "E2E Wireless Headphones - Amazon"
  );

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("prompt");
    await dialog.accept("39.99");
  });

  await page.getByRole("button", { name: /Target: Not set/ }).click();

  await expect(
    page.getByRole("button", { name: /Target: \$39\.99/ })
  ).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.locator("#who")).toHaveAttribute("aria-label", "Sign in");
});
