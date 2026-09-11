/**
 * Compares stored USD item prices, excluding shipping and tax.
 */
export class ComparisonService {
  /**
   * Summarizes offers without modifying the supplied array.
   * @param {Array<{retailer: string, price_cents: number, currency: string}>} offers Stored retailer offers.
   * @returns {object} Price comparison summary.
   */
  compare(offers) {
    if (offers.length === 0) {
      return {
        currency: "USD",
        lowest_price_cents: null,
        lowest_price_retailers: [],
        price_difference_cents: null
      };
    }

    if (
      offers.some(
        (offer) =>
          offer.currency !== "USD" ||
          !Number.isInteger(offer.price_cents) ||
          offer.price_cents < 0
      )
    ) {
      throw new Error("Comparison requires nonnegative integer USD prices.");
    }

    const prices = offers.map((offer) => offer.price_cents);
    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);

    return {
      currency: "USD",
      lowest_price_cents: lowest,
      lowest_price_retailers: [
        ...new Set(
          offers
            .filter((offer) => offer.price_cents === lowest)
            .map((offer) => offer.retailer)
        )
      ].sort(),
      price_difference_cents: highest - lowest
    };
  }
}
