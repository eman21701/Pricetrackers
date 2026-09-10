import pg from "pg";

const { Pool } = pg;

/**
 * Manages PostgreSQL connections for the application.
 */
export class Database {
  #pool;

  constructor() {
    this.#pool = new Pool({
      connectionTimeoutMillis: 3000,
      query_timeout: 3000,
      max: 5
    });

    this.#pool.on("error", (error) => {
      console.error("Idle database connection error:", error.message);
    });
  }

  /**
   * Verifies that PostgreSQL can execute a query.
   * @returns {Promise<void>}
   */
  async checkConnection() {
    await this.#pool.query("SELECT 1");
  }
}