/**
 * Retrieves product catalog data from PostgreSQL.
 */
export class ProductRepository {
  #database;

  /**
   * @param {import("./Database.js").Database} database Database access.
   */
  constructor(database) {
    this.#database = database;
  }

  /**
   * Searches names, brands, and models using literal substring matching.
   * Returns at most 50 products.
   * @param {string} search Search text.
   * @returns {Promise<Array>}
   */
  async search(search) {
    const result = await this.#database.query(
      `SELECT id, name, brand, model
       FROM products
       WHERE strpos(
         lower(name || ' ' || brand || ' ' || model),
         lower($1)
       ) > 0
       ORDER BY name, id
       LIMIT 50`,
      [search]
    );

    return result.rows;
  }

  /**
   * Retrieves one product.
   * @param {number} id Product identifier.
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const result = await this.#database.query(
      "SELECT id, name, brand, model FROM products WHERE id = $1",
      [id]
    );

    return result.rows[0] ?? null;
  }

  /**
   * Retrieves offers ordered by price, then retailer name.
   * @param {number} productId Product identifier.
   * @returns {Promise<Array>}
   */
  async findOffers(productId) {
    const result = await this.#database.query(
      `SELECT o.id, r.name AS retailer, o.price_cents,
              o.currency, o.is_synthetic, o.observed_at
       FROM offers o
       JOIN retailers r ON r.id = o.retailer_id
       WHERE o.product_id = $1
       ORDER BY o.price_cents, r.name, o.id`,
      [productId]
    );

    return result.rows;
  }
}
