module.exports = {
  development: {
    client: "pg",
    connection: {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD
    },
    migrations: {
      directory: "./migrations",
      loadExtensions: [".cjs"]
    }
  }
};