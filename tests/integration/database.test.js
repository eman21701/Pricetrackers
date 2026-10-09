import test from "node:test";
import assert from "node:assert/strict";
import knex from "knex";
import config from "../../knexfile.cjs";

test("migrations and repeatable seeds work with PostgreSQL", async () => {
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.PGDATABASE, "pricetrackers_test");
  assert.equal(process.env.PGHOST, "test-database");

  const database = knex(config.development);

  try {
    await database.migrate.latest();

    for (const table of [
      "products",
      "retailers",
      "offers",
      "users",
      "sessions"
    ]) {
      assert.equal(
        await database.schema.hasTable(table),
        true,
        `${table} table should exist`
      );
    }

    await database.seed.run();
    await database.seed.run();

    const products = await database("products").select("*");
    const retailers = await database("retailers").select("*");
    const offers = await database("offers").select("*");

    assert.equal(products.length, 3);
    assert.equal(retailers.length, 2);
    assert.equal(offers.length, 6);
    assert.ok(offers.every((offer) => offer.is_synthetic === true));

    const headphones = products.find(
      (product) => product.model === "DEMO-HEADPHONES-001"
    );

    assert.ok(headphones, "Headphones should exist");

    const headphonePrices = offers
      .filter((offer) => offer.product_id === headphones.id)
      .map((offer) => offer.price_cents)
      .sort((a, b) => a - b);

    assert.deepEqual(headphonePrices, [4999, 5499]);
  } finally {
    await database.destroy();
  }
});
