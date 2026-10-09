/**
 * Creates account-specific saved items.
 * @param {import("knex").Knex} knex Database migration connection.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable("wishlist_items", (table) => {
    table.increments("id").primary();

    table.integer("user_id").notNullable().references("id").inTable("users");

    table.string("retailer", 40).notNullable();
    table.string("external_id", 255).notNullable();
    table.string("title", 500).notNullable();

    table.integer("price_cents").notNullable();
    table.integer("target_price_cents").nullable();
    table.string("currency", 3).notNullable().defaultTo("USD");

    table.text("link").notNullable();
    table.text("thumbnail").nullable();

    table.timestamps(true, true);
    table.timestamp("deleted_at", { useTz: true }).nullable();

    table.unique(["user_id", "retailer", "external_id"]);
    table.index(["user_id", "deleted_at"]);

    table.check("price_cents >= 0");
    table.check("target_price_cents IS NULL OR target_price_cents >= 0");
  });
};

/**
 * Removes the wishlist table.
 * @param {import("knex").Knex} knex Database migration connection.
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("wishlist_items");
};
