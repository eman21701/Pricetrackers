import test from "node:test";
import assert from "node:assert/strict";
import { ComparisonService } from "../../src/ComparisonService.js";

const service = new ComparisonService();

/**
 * Creates a synthetic offer for comparison tests.
 * @param {string} retailer Retailer name.
 * @param {number} priceCents Item price in cents.
 * @param {string} currency Currency code.
 * @returns {object} Test offer.
 */
function offer(retailer, priceCents, currency = "USD") {
  return {
    retailer,
    price_cents: priceCents,
    currency
  };
}

test("finds Walmart as cheapest even when offers are unsorted", () => {
  const result = service.compare([
    offer("Amazon", 5499),
    offer("Walmart", 4999)
  ]);

  assert.deepEqual(result, {
    currency: "USD",
    lowest_price_cents: 4999,
    lowest_price_retailers: ["Walmart"],
    price_difference_cents: 500
  });
});

test("finds Amazon as cheapest", () => {
  const result = service.compare([
    offer("Walmart", 3499),
    offer("Amazon", 2999)
  ]);

  assert.equal(result.lowest_price_cents, 2999);
  assert.deepEqual(result.lowest_price_retailers, ["Amazon"]);
  assert.equal(result.price_difference_cents, 500);
});

test("returns both retailers when prices tie", () => {
  const result = service.compare([
    offer("Walmart", 1999),
    offer("Amazon", 1999)
  ]);

  assert.deepEqual(result.lowest_price_retailers, ["Amazon", "Walmart"]);
  assert.equal(result.lowest_price_cents, 1999);
  assert.equal(result.price_difference_cents, 0);
});

test("returns no lowest price when there are no offers", () => {
  assert.deepEqual(service.compare([]), {
    currency: "USD",
    lowest_price_cents: null,
    lowest_price_retailers: [],
    price_difference_cents: null
  });
});

test("handles one offer without inventing a price difference", () => {
  const result = service.compare([offer("Walmart", 1200)]);

  assert.equal(result.lowest_price_cents, 1200);
  assert.deepEqual(result.lowest_price_retailers, ["Walmart"]);
  assert.equal(result.price_difference_cents, 0);
});

test("accepts a zero-cent offer", () => {
  const result = service.compare([
    offer("Amazon", 0),
    offer("Walmart", 100)
  ]);

  assert.equal(result.lowest_price_cents, 0);
  assert.equal(result.price_difference_cents, 100);
});

test("rejects negative, fractional, and nonnumeric prices", () => {
  for (const price of [-1, 19.99, "1999", NaN, Infinity]) {
    assert.throws(
      () => service.compare([offer("Amazon", price)]),
      /nonnegative integer USD prices/
    );
  }
});

test("rejects unsupported currencies", () => {
  assert.throws(
    () => service.compare([offer("Amazon", 1999, "EUR")]),
    /nonnegative integer USD prices/
  );
});

test("does not modify the original offers", () => {
  const offers = [
    offer("Amazon", 5499),
    offer("Walmart", 4999)
  ];
  const original = structuredClone(offers);

  service.compare(offers);

  assert.deepEqual(offers, original);
});