import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: "artifacts/playwright-report",
        open: "never"
      }
    ],
    [
      "json",
      {
        outputFile: "artifacts/playwright-results.json"
      }
    ]
  ],
  outputDir: "artifacts/playwright-output",
  use: {
    baseURL: "http://127.0.0.1:4173",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] }
    }
  ],
  webServer: [
    {
      command: "npm start",
      url: "http://127.0.0.1:3000/ready",
      name: "backend",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe"
    },
    {
      command: "npm run serve:frontend",
      url: "http://127.0.0.1:4173",
      name: "frontend",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe"
    }
  ]
});
