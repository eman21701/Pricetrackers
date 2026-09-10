import pg from "pg";

const { Pool } = pg;

/**
 * Manages PostgreSQL connections and parameterized queries.
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
   * Executes SQL with separately supplied parameter values.
   * @param {string} text SQL statement.
   * @param {Array} values Parameter values.
   * @returns {Promise<import("pg").QueryResult>}
   */
  async query(text, values = []) {
    return this.#pool.query(text, values);
  }

  /**
   * Verifies that PostgreSQL can execute a query.
   * @returns {Promise<void>}
   */
  async checkConnection() {
    await this.query("SELECT 1");
  }
}