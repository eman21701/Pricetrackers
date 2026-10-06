/**
 * @typedef {import("express").Express} ExpressApp
 * @typedef {import("express").Request} ExpressRequest
 * @typedef {import("express").Response} ExpressResponse
 */

/**
 * @typedef {Object} LiveOffer
 * @property {string} id
 * @property {string} title
 * @property {number} price_cents
 * @property {string} currency
 * @property {number | null} rating
 * @property {string} link
 * @property {string | null} thumbnail
 * @property {boolean} sponsored
 */

/**
 * Registers the SerpAPI product search route.
 * @param {ExpressApp} app Express application.
 */
export function registerLiveSearch(app) {
  app.get("/api/live-search", async (request, response) => {
    await handleLiveSearch(request, response);
  });
}

/**
 * @param {ExpressRequest} request Incoming request.
 * @param {ExpressResponse} response Outgoing response.
 */
async function handleLiveSearch(request, response) {
  const query = String(request.query.q ?? "").trim();

  if (!query || query.length > 80) {
    return response.status(400).json({
      error: "Query must be 1 to 80 characters.",
      code: "INVALID_SEARCH"
    });
  }

  const apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey) {
    return response.status(503).json({
      error: "SERPAPI_API_KEY is not configured.",
      code: "SEARCH_NOT_CONFIGURED"
    });
  }

  try {
    const [amazon, walmart] = await Promise.all([
      serp(apiKey, {
        engine: "amazon",
        k: query,
        amazon_domain: "amazon.com"
      }),
      serp(apiKey, { engine: "walmart", query })
    ]);

    response.json({
      query,
      notice:
        "Live search results. Prices exclude tax and shipping and are not matched to the same listing yet.",
      amazon: amazonOffers(amazon),
      walmart: walmartOffers(walmart)
    });
  } catch (error) {
    console.error(
      "Live search failed:",
      error instanceof Error ? error.message : String(error)
    );

    response.status(502).json({
      error: "Retailer search failed.",
      code: "SEARCH_FAILED"
    });
  }
}

/**
 * @param {string} apiKey SerpAPI key.
 * @param {Record<string, string>} params Search parameters.
 */
async function serp(apiKey, params) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("api_key", apiKey);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const result = await fetch(url);
  const body = await result.json();

  if (!result.ok || body.error) {
    throw new Error(body.error || "SerpAPI request failed");
  }

  return body;
}

/**
 * @param {any} body SerpAPI Amazon response.
 * @returns {LiveOffer[]}
 */
function amazonOffers(body) {
  const results = Array.isArray(body.organic_results)
    ? body.organic_results
    : [];
  
  return results
    .filter((/** @type {any} */ item) =>
      Number.isFinite(item.primary_offer?.offer_price)
    )
    .slice(0, 8)
    .map((/** @type {any} */ item) => ({
      id: String(item.asin),
      title: String(item.title),
      price_cents: Math.round(item.extracted_price * 100),
      currency: "USD",
      rating: typeof item.rating === "number" ? item.rating : null,
      link: String(item.link_clean || item.link),
      thumbnail: item.thumbnail ? String(item.thumbnail) : null,
      sponsored: Boolean(item.sponsored)
    }));
}

/**
 * @param {any} body SerpAPI Walmart response.
 * @returns {LiveOffer[]}
 */
function walmartOffers(body) {
  const results = Array.isArray(body.organic_results)
    ? body.organic_results
    : [];
  
  return results
    .filter((/** @type {any} */ item) =>
      Number.isFinite(item.primary_offer?.offer_price)
    )
    .slice(0, 8)
    .map((/** @type {any} */ item) => ({
      id: String(item.us_item_id),
      title: String(item.title),
      price_cents: Math.round(item.primary_offer.offer_price * 100),
      currency: String(item.primary_offer.currency || "USD"),
      rating: typeof item.rating === "number" ? item.rating : null,
      link: String(item.product_page_url),
      thumbnail: item.thumbnail ? String(item.thumbnail) : null,
      sponsored: Boolean(item.sponsored)
    }));
}
