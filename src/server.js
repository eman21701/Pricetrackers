import express from "express";

/**
 * Configures the PriceTrackers HTTP API.
 */
class PriceTrackersApplication {
  #app;

  constructor() {
    this.#app = express();
    this.#app.disable("x-powered-by");
    this.#app.use(express.json());

    this.#app.get("/health", (_request, response) => {
      response.status(200).json({
        status: "ok",
        service: "pricetrackers-api"
      });
    });
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

const application = new PriceTrackersApplication();
application.start(port);