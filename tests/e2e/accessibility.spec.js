import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

const searchFixture = {
  query: "accessibility fixture",
  notice: "Deterministic accessibility fixture; no retailer request was made.",
  amazon: [
    {
      id: "a11y-amazon-headphones",
      title: "Accessible Headphones - Amazon",
      price_cents: 5499,
      currency: "USD",
      rating: 4.6,
      link: "https://example.com/amazon-headphones",
      thumbnail: "http://127.0.0.1:4173/logo-mark.png",
      sponsored: false
    }
  ],
  walmart: [
    {
      id: "a11y-walmart-headphones",
      title: "Accessible Headphones - Walmart",
      price_cents: 4999,
      currency: "USD",
      rating: 4.5,
      link: "https://example.com/walmart-headphones",
      thumbnail: "http://127.0.0.1:4173/logo-mark.png",
      sponsored: false
    }
  ]
};

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "reduce"
  });

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

  // Axe should measure the completed interface, not partially faded animation
  // frames. Motion behavior is covered by the reduced-motion media preference.
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
      }
    `
  });

  await expect(
    page.getByRole("heading", {
      name: "Search once. See both prices."
    })
  ).toBeVisible();

  await expect(page.locator(".card")).toHaveCount(2);
});

test("primary views pass automated WCAG 2.1 A and AA checks", async ({
  page
}, testInfo) => {
  const scans = [];

  scans.push({
    name: "home",
    results: await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  });

  await page.locator("#who").click();
  await expect(page.locator("#auth-window")).toBeVisible();

  scans.push({
    name: "authentication dialog",
    results: await new AxeBuilder({ page })
      .include("#auth-window")
      .withTags(wcagTags)
      .analyze()
  });

  await page.locator("#close-auth").click();

  await page.locator('[data-view="search"]').click();

  const searchForm = page.locator("form.search");

  await searchForm
    .getByRole("textbox", {
      name: "Search products"
    })
    .fill("wireless headphones");

  await searchForm.getByRole("button", { name: "Search" }).click();
  await expect(page.locator(".card")).toHaveCount(2);

  scans.push({
    name: "search results",
    results: await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  });

  const projectName = testInfo.project.name.replace(/[^a-z0-9-]+/gi, "-");
  const outputDirectory = path.join("artifacts", "accessibility");

  await mkdir(outputDirectory, { recursive: true });

  await writeFile(
    path.join(outputDirectory, `axe-${projectName}.json`),
    JSON.stringify(
      {
        project: testInfo.project.name,
        scans
      },
      null,
      2
    )
  );

  for (const scan of scans) {
    expect(
      scan.results.violations,
      `${scan.name} contains automated WCAG violations`
    ).toEqual([]);
  }
});

test("primary navigation and search work using the keyboard", async ({
  page
}) => {
  await page.locator("#brand").focus();

  await page.keyboard.press("Tab");
  await expect(page.locator("#theme-toggle")).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.locator("#basket-button")).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.locator("#who")).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("#auth-window")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator("#auth-window")).not.toBeVisible();

  await page.locator('[data-view="search"]').focus();
  await page.keyboard.press("Enter");

  const searchInput = page.getByRole("textbox", {
    name: "Search products"
  });

  await expect(searchInput).toBeFocused();

  await page.keyboard.type("wireless headphones");
  await page.keyboard.press("Enter");

  await expect(page.locator(".card")).toHaveCount(2);

  const addButton = page
    .getByRole("button", {
      name: "Add to basket"
    })
    .first();

  await addButton.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("#basket-count")).toHaveText("1");
});

test("primary controls expose screen-reader names and landmarks", async ({
  page
}) => {
  await expect(page.getByRole("main")).toHaveCount(1);

  await expect(
    page.getByRole("navigation", {
      name: "Main"
    })
  ).toBeVisible();

  await expect(page.getByRole("search")).toBeVisible();

  await expect(
    page.getByRole("textbox", {
      name: "Search products"
    })
  ).toBeVisible();

  await expect(
    page.getByRole("button", {
      name: "Switch light or dark theme"
    })
  ).toBeVisible();

  await expect(page.locator("#view")).toHaveAttribute("aria-live", "polite");

  await page.locator("#who").click();

  await expect(
    page.getByRole("dialog", {
      name: "Welcome back"
    })
  ).toBeVisible();

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();

  await expect(page.locator("#auth-notice")).toHaveAttribute("role", "alert");

  await page
    .getByRole("tab", {
      name: "Create account"
    })
    .click();

  await expect(page.getByLabel("Name")).toBeVisible();

  await expect(
    page.getByRole("tab", {
      name: "Create account"
    })
  ).toHaveAttribute("aria-selected", "true");
});
