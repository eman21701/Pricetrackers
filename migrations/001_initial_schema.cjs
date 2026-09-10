/**
 * Creates the initial product comparison schema.
 * @param {import("knex").Knex} knex Database query builder.
 */
exports.up = async function (knex) {
  await knex.schema.createTable("products", (table) => {
    table.increments("id").primary();
    table.string("name", 255).notNullable();
    table.string("brand", 100).notNullable();
    table.string("model", 100).notNullable();
    table.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.unique(["brand", "model"]);
  });

  await knex.schema.createTable("retailers", (table) => {
    table.increments("id").primary();
    table.string("name", 50).notNullable().unique();
  });

  await knex.schema.createTable("offers", (table) => {
    table.increments("id").primary();

    table.integer("product_id")
      .notNullable()
      .references("id")
      .inTable("products")
      .onDelete("RESTRICT");

    table.integer("retailer_id")
      .notNullable()
      .references("id")
      .inTable("retailers")
      .onDelete("RESTRICT");

    table.string("retailer_product_id", 100).notNullable();
    table.integer("price_cents").notNullable();
    table.string("currency", 3).notNullable().defaultTo("USD");
    table.boolean("is_synthetic").notNullable().defaultTo(true);

    table.timestamp("observed_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.check("price_cents >= 0");
    table.check("currency = 'USD'");
    table.unique(["retailer_id", "retailer_product_id"]);
    table.index(["product_id"]);
  });
};

/**
 * Removes the initial schema in dependency order.
 * This also removes any data stored in these tables.
 * @param {import("knex").Knex} knex Database query builder.
 */
exports.down = async function (knex) {
  await knex.schema.dropTable("offers");
  await knex.schema.dropTable("retailers");
  await knex.schema.dropTable("products");
};