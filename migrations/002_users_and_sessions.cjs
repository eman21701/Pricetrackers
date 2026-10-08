exports.up = async function up(knex) {
  await knex.schema.createTable("users", (table) => {
    table.increments("id").primary();
    table.string("email").notNullable().unique();
    table.string("name").notNullable();
    table.string("password_hash");
    table.string("google_sub").unique();
    table.timestamps(true, true);
  });

  await knex.schema.createTable("sessions", (table) => {
    table.string("token").primary();
    table
      .integer("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.timestamp("expires_at").notNullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("sessions");
  await knex.schema.dropTableIfExists("users");
};
