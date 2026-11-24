import test from "node:test";
import assert from "node:assert/strict";
import { registerLiveSearch } from "../../src/LiveSearch.js";

/**
 * Uses a fake key and restores the original environment after each test.
 * @param {import("node:test").TestContext} t Test context.
 * @param {string} key Fake API key (empty means not configured).
 */
function setTestKey(t, key = "unit-test-key") {
  const previous = process.env.SERPAPI_API_KEY;
  process.env.SERPAPI_API_KEY = key;
  t.after(() => {
    if (previous === undefined) {
      delete process.env.SERPAPI_API_KEY;
    } else {
      process.env.SERPAPI_API_KEY = previous;
    }
  });
}

/**
 * Captures and invokes the real registered route without starting a server.
 * @param {{ q?: string }} query Request query parameters.
 */
async function search(query) {
  const routes = new Map();
  const app = {
    get(
      /** @type {string} */ path,
      /** @type {import("express").RequestHandler} */ handler
    ) {
      routes.set(path, handler);
    }
  };
  registerLiveSearch(
    /** @type {import("express").Express} */ (/** @type {unknown} */ (app))
  );

  const handler = routes.get("/api/live-search");
  assert.ok(handler);
  let status = 200;
  let body;
  const response = {
    locals: { requestId: "unit-test" },
    status(/** @type {number} */ code) {
      status = code;
      return this;
    },
    json(/** @type {unknown} */ payload) {
      body = payload;
      return this;
    }
  };

  await handler({ query }, response);
  return { status, body };
}

/**
 * Replaces fetch with deterministic responses for both retailers.
 * @param {import("node:test").TestContext} t Test context.
 * @param {unknown} amazon Amazon response body.
 * @param {unknown} walmart Walmart response body.
 */
function mockRetailers(t, amazon, walmart) {
  return t.mock.method(
    globalThis,
    "fetch",
    (/** @type {Parameters<typeof fetch>[0]} */ input) => {
      const url = new URL(String(input));
      return Promise.resolve(
        Response.json(
          url.searchParams.get("engine") === "amazon" ? amazon : walmart
        )
      );
    }
  );
}

test("normalizes retailer results and excludes invalid prices", async (t) => {
  setTestKey(t);
  const fetchMock = mockRetailers(
    t,
    {
      organic_results: [
        {
          asin: "A1",
          title: "Amazon Headphones",
          extracted_price: 49.99,
          rating: 4.5,
          link_clean: "https://example.com/amazon-clean",
          link: "https://example.com/amazon",
          thumbnail: "https://example.com/amazon.png",
          sponsored: true
        },
        {
          asin: "A2",
          title: "Amazon Speaker",
          price: "$1,249.50",
          link: "https://example.com/speaker"
        },
        { asin: "A3", title: "Missing price" },
        { asin: "A4", price: "Unavailable" }
      ]
    },
    {
      organic_results: [
        {
          us_item_id: 101,
          title: "Walmart Headphones",
          primary_offer: { offer_price: 39.95, currency: "USD" },
          rating: 4,
          product_page_url: "https://example.com/walmart",
          thumbnail: "https://example.com/walmart.png",
          sponsored: true
        },
        {
          us_item_id: 102,
          title: "Walmart Speaker",
          primary_offer: { offer_price: 25.5 },
          product_page_url: "https://example.com/walmart-speaker"
        },
        { us_item_id: 103 },
        { us_item_id: 104, primary_offer: { offer_price: "19.99" } }
      ]
    }
  );

  const result = await search({ q: "  headphones  " });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    query: "headphones",
    notice:
      "Live search results. Prices exclude tax and shipping and are not matched to the same listing yet.",
    amazon: [
      {
        id: "A1",
        title: "Amazon Headphones",
        price_cents: 4999,
        currency: "USD",
        rating: 4.5,
        link: "https://example.com/amazon-clean",
        thumbnail: "https://example.com/amazon.png",
        sponsored: true
      },
      {
        id: "A2",
        title: "Amazon Speaker",
        price_cents: 124950,
        currency: "USD",
        rating: null,
        link: "https://example.com/speaker",
        thumbnail: null,
        sponsored: false
      }
    ],
    walmart: [
      {
        id: "101",
        title: "Walmart Headphones",
        price_cents: 3995,
        currency: "USD",
        rating: 4,
        link: "https://example.com/walmart",
        thumbnail: "https://example.com/walmart.png",
        sponsored: true
      },
      {
        id: "102",
        title: "Walmart Speaker",
        price_cents: 2550,
        currency: "USD",
        rating: null,
        link: "https://example.com/walmart-speaker",
        thumbnail: null,
        sponsored: false
      }
    ]
  });

  assert.equal(fetchMock.mock.callCount(), 2);
  const urls = fetchMock.mock.calls.map(
    (call) => new URL(String(call.arguments[0]))
  );
  const amazon = urls.find(
    (url) => url.searchParams.get("engine") === "amazon"
  );
  const walmart = urls.find(
    (url) => url.searchParams.get("engine") === "walmart"
  );
  assert.ok(amazon);
  assert.ok(walmart);
  for (const url of urls) {
    assert.equal(url.origin, "https://serpapi.com");
    assert.equal(url.pathname, "/search.json");
    assert.equal(url.searchParams.get("api_key"), "unit-test-key");
  }
  assert.equal(amazon.searchParams.get("k"), "headphones");
  assert.equal(amazon.searchParams.get("amazon_domain"), "amazon.com");
  assert.equal(walmart.searchParams.get("query"), "headphones");
});

test("returns empty lists for missing or malformed retailer results", async (t) => {
  setTestKey(t);
  mockRetailers(t, {}, { organic_results: null });
  const result = await search({ q: "headphones" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    query: "headphones",
    notice:
      "Live search results. Prices exclude tax and shipping and are not matched to the same listing yet.",
    amazon: [],
    walmart: []
  });
});

test("rejects missing, blank and overlong queries without calling fetch", async (t) => {
  setTestKey(t);
  const fetchMock = mockRetailers(t, {}, {});
  for (const query of [{}, { q: "   " }, { q: "a".repeat(81) }]) {
    const result = await search(query);
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, {
      error: "Query must be 1 to 80 characters.",
      code: "INVALID_SEARCH"
    });
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("returns 503 when SerpAPI is not configured", async (t) => {
  setTestKey(t, "");
  const fetchMock = mockRetailers(t, {}, {});
  const result = await search({ q: "headphones" });
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, {
    error: "SERPAPI_API_KEY is not configured.",
    code: "SEARCH_NOT_CONFIGURED"
  });
  assert.equal(fetchMock.mock.callCount(), 0);
});

/** @param {{ status: number; body: unknown }} result Route result. */
function assertSearchFailed(result) {
  assert.equal(result.status, 502);
  assert.deepEqual(result.body, {
    error: "Retailer search failed.",
    code: "SEARCH_FAILED"
  });
}

test("handles HTTP errors without exposing upstream details", async (t) => {
  setTestKey(t);
  t.mock.method(globalThis, "fetch", () =>
    Promise.resolve(Response.json({}, { status: 429 }))
  );
  assertSearchFailed(await search({ q: "headphones" }));
});

test("handles SerpAPI error fields even with a successful HTTP status", async (t) => {
  setTestKey(t);
  mockRetailers(t, { error: "Synthetic upstream error" }, {});
  assertSearchFailed(await search({ q: "headphones" }));
});

test("handles network failures", async (t) => {
  setTestKey(t);
  t.mock.method(globalThis, "fetch", () =>
    Promise.reject(new Error("Synthetic network failure"))
  );
  assertSearchFailed(await search({ q: "headphones" }));
});

test("handles non-Error rejections from the external dependency", async (t) => {
  setTestKey(t);
  t.mock.method(globalThis, "fetch", () => Promise.reject("Synthetic failure"));
  assertSearchFailed(await search({ q: "headphones" }));
});
