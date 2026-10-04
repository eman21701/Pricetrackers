import express from "express";
import { Database } from "./Database.js";
import { ProductRepository } from "./ProductRepository.js";
import { ComparisonService } from "./ComparisonService.js";

/**
 * Configures the PriceTrackers HTTP API.
 */
class PriceTrackersApplication {
  #app;
  #database;
  #products;
  #comparison;

  /**
   * @param {Database} database Application database access.
   */
  constructor(database) {
    this.#database = database;
    this.#products = new ProductRepository(database);
    this.#comparison = new ComparisonService();

    this.#app = express();
    this.#app.disable("x-powered-by");
    this.#app.use(express.json());

    this.#app.get("/health", (_request, response) => {
      response.status(200).json({
        status: "ok",
        service: "pricetrackers-api"
      });
    });

    this.#app.get("/ready", async (_request, response) => {
      try {
        await this.#database.checkConnection();

        response.status(200).json({
          status: "ready",
          database: "connected"
        });
      } catch (error) {
        console.error(
          "Database readiness check failed:",
          error instanceof Error ? error.message : String(error)
        );

        response.status(503).json({
          status: "not_ready",
          database: "unavailable"
        });
      }
    });
registerLiveSearch(this.#app);
    
    this.#app.get("/api/products", async (request, response) => {
      const search = request.query.search ?? "";

      if (typeof search !== "string" || search.length > 100) {
        return response.status(400).json({
          error: "Search must be a string of at most 100 characters.",
          code: "INVALID_SEARCH"
        });
      }

      const products = await this.#products.search(search.trim());

      response.json({
        products,
        count: products.length,
        limit: 50
      });
    });

    this.#app.get("/api/products/:id/offers", async (request, response) => {
      const rawId = request.params.id;
      const id = Number(rawId);

      if (
        !/^[1-9]\d*$/.test(rawId) ||
        !Number.isSafeInteger(id) ||
        id > 2147483647
      ) {
        return response.status(400).json({
          error: "Product ID must be a valid positive integer.",
          code: "INVALID_PRODUCT_ID"
        });
      }

      const product = await this.#products.findById(id);

      if (!product) {
        return response.status(404).json({
          error: "Product not found.",
          code: "PRODUCT_NOT_FOUND"
        });
      }

      const offers = await this.#products.findOffers(id);

      response.json({
        product,
        offers,
        comparison: this.#comparison.compare(offers),
        notice:
          "Prototype demo data. Synthetic offers are not live retailer prices. Item prices exclude shipping and tax."
      });
    });

    this.#app.use((_request, response) => {
      response.status(404).json({
        error: "Endpoint not found.",
        code: "NOT_FOUND"
      });
    });

    /** @type {import("express").ErrorRequestHandler} */
    const handleError = (
      /** @type {unknown} */ error,
      _request,
      response,
      _next
    ) => {
      console.error(
        "API request failed:",
        error instanceof Error ? error.message : String(error)
      );

      const invalidJson =
        typeof error === "object" &&
        error !== null &&
        "type" in error &&
        error.type === "entity.parse.failed";

      return response.status(invalidJson ? 400 : 500).json({
        error: invalidJson
          ? "Invalid JSON body."
          : "Unable to process request.",
        code: invalidJson ? "INVALID_JSON" : "INTERNAL_ERROR"
      });
    };

    this.#app.use(handleError);
  }

  /**
   * Starts the API on the supplied port.
   * @param {number} port HTTP listening port.
   */
  start(port) {
    return this.#app.listen(port, "0.0.0.0", () => {
      console.log(`PriceTrackers API listening on port ${port}`);
    });
  }
}

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const database = new Database();
const application = new PriceTrackersApplication(database);
application.start(port);
