/* global __ENV */

import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.BASE_URL ?? "http://performance-backend:3000";

export const options = {
  scenarios: {
    loadAndStress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5s", target: 5 },
        { duration: "10s", target: 5 },
        { duration: "5s", target: 20 },
        { duration: "10s", target: 20 },
        { duration: "5s", target: 0 }
      ],
      gracefulRampDown: "5s"
    }
  },
  thresholds: {
    checks: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"]
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "max"]
};

export default function () {
  const [health, ready, search] = http.batch([
    ["GET", `${baseUrl}/health`, null, { tags: { endpoint: "health" } }],
    ["GET", `${baseUrl}/ready`, null, { tags: { endpoint: "ready" } }],
    [
      "GET",
      `${baseUrl}/api/products?search=headphones`,
      null,
      { tags: { endpoint: "stored-product-search" } }
    ]
  ]);

  check(health, {
    "health probe returns 200": (response) => response.status === 200
  });
  check(ready, {
    "readiness probe returns 200": (response) => response.status === 200
  });
  check(search, {
    "stored search returns 200": (response) => response.status === 200,
    "stored search returns the demo product": (response) =>
      typeof response.body === "string" &&
      response.body.includes("DEMO-HEADPHONES-001")
  });

  sleep(0.5);
}
