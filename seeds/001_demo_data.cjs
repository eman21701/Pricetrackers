/**
 * Inserts synthetic demo products and offers.
 * Repeated runs update these demo records without duplicating them.
 * @param {import("knex").Knex} knex Database query builder.
 */
exports.seed = async function (knex) {
  const demoProducts = [
    {
      name: "Demo Wireless Headphones",
      brand: "PriceTrackers Demo",
      model: "DEMO-HEADPHONES-001",
      prices: { Walmart: 4999, Amazon: 5499 }
    },
    {
      name: "Demo Coffee Maker",
      brand: "PriceTrackers Demo",
      model: "DEMO-COFFEE-001",
      prices: { Walmart: 3499, Amazon: 2999 }
    },
    {
      name: "Demo USB-C Charger",
      brand: "PriceTrackers Demo",
      model: "DEMO-CHARGER-001",
      prices: { Walmart: 1999, Amazon: 1999 }
    }
  ];

  await knex.transaction(async (trx) => {
    const retailerIds = {};

    for (const name of ["Walmart", "Amazon"]) {
      await trx("retailers")
        .insert({ name })
        .onConflict("name")
        .ignore();

      const retailer = await trx("retailers")
        .where({ name })
        .first();

      retailerIds[name] = retailer.id;
    }

    for (const demo of demoProducts) {
      const [product] = await trx("products")
        .insert({
          name: demo.name,
          brand: demo.brand,
          model: demo.model
        })
        .onConflict(["brand", "model"])
        .merge(["name"])
        .returning(["id"]);

      for (const [retailer, priceCents] of Object.entries(demo.prices)) {
        await trx("offers")
          .insert({
            product_id: product.id,
            retailer_id: retailerIds[retailer],
            retailer_product_id: `SYNTHETIC-${retailer}-${demo.model}`,
            price_cents: priceCents,
            currency: "USD",
            is_synthetic: true,
            observed_at: "2026-09-01T00:00:00.000Z"
          })
          .onConflict(["retailer_id", "retailer_product_id"])
          .merge([
            "product_id",
            "price_cents",
            "currency",
            "is_synthetic",
            "observed_at"
          ]);
      }
    }
  });
};