import { Router } from "express";
import { getSessionUserId } from "./Auth.js";

/**
 * @param {unknown} value Value to check.
 * @param {number} max Maximum length.
 */
function validText(value, max) {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  );
}

/** @param {unknown} value Price in cents. */
function validPrice(value) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 2147483647
  );
}

/** @param {unknown} value External link. */
function validUrl(value) {
  if (!validText(value, 2048)) return false;

  try {
    const url = new URL(String(value));

    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

/** @param {Record<string, unknown>} item Submitted item. */
function validItem(item) {
  const checks = [
    ["Amazon", "Walmart"].includes(String(item.retailer)),
    validText(item.external_id, 255),
    validText(item.title, 500),
    validPrice(item.price_cents),
    item.currency === "USD",
    validUrl(item.link),
    item.thumbnail === null ||
      item.thumbnail === undefined ||
      validUrl(item.thumbnail)
  ];

  return checks.every(Boolean);
}

/**
 * Registers wishlist CRUD routes for the signed-in account.
 * @param {import("express").Express} app Express application.
 * @param {import("./Database.js").Database} database Database access.
 */
export function registerWishlist(app, database) {
  const router = Router();

  const allowedOrigins = new Set([
    "http://127.0.0.1:4173",
    "http://localhost:4173",
    "http://127.0.0.1:3000",
    "http://localhost:3000"
  ]);

  router.use(async (request, response, next) => {
    const userId = await getSessionUserId(database, request.headers.cookie);

    if (userId === null) {
      return response.status(401).json({
        error: "Please sign in.",
        code: "AUTH_REQUIRED"
      });
    }

    response.locals.userId = userId;
    next();
  });

  router.use((request, response, next) => {
    const origin = request.headers.origin;

    if (request.method !== "GET" && origin && !allowedOrigins.has(origin)) {
      return response.status(403).json({
        error: "Origin not allowed."
      });
    }

    if (
      ["POST", "PATCH"].includes(request.method) &&
      !request.is("application/json")
    ) {
      return response.status(415).json({
        error: "Send an application/json body."
      });
    }

    next();
  });

  router.get("/", async (_request, response) => {
    const result = await database.query(
      `SELECT id, retailer, external_id, title, price_cents,
              target_price_cents, currency, link, thumbnail,
              created_at, updated_at
       FROM wishlist_items
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC, id DESC`,
      [response.locals.userId]
    );

    response.json({
      items: result.rows,
      count: result.rows.length
    });
  });

  router.post("/", async (request, response) => {
    const item = request.body ?? {};

    if (!validItem(item)) {
      return response.status(400).json({
        error: "Invalid wishlist item.",
        code: "INVALID_ITEM"
      });
    }

    const result = await database.query(
      `INSERT INTO wishlist_items
         (user_id, retailer, external_id, title, price_cents,
          currency, link, thumbnail)
       VALUES ($1, $2, $3, $4, $5, 'USD', $6, $7)
       ON CONFLICT (user_id, retailer, external_id) DO UPDATE SET
         title = EXCLUDED.title,
         price_cents = EXCLUDED.price_cents,
         link = EXCLUDED.link,
         thumbnail = EXCLUDED.thumbnail,
         deleted_at = NULL,
         updated_at = NOW()
       RETURNING id`,
      [
        response.locals.userId,
        item.retailer,
        item.external_id.trim(),
        item.title.trim(),
        item.price_cents,
        item.link,
        item.thumbnail ?? null
      ]
    );

    response.status(200).json({
      id: result.rows[0].id
    });
  });

  router.param("id", (_request, response, next, rawId) => {
    const id = Number(rawId);

    if (
      !/^[1-9]\d*$/.test(rawId) ||
      !Number.isSafeInteger(id) ||
      id > 2147483647
    ) {
      return response.status(400).json({
        error: "Invalid wishlist ID."
      });
    }

    response.locals.itemId = id;
    next();
  });

  router.patch("/:id", async (request, response) => {
    const target = request.body?.target_price_cents;

    if (target !== null && !validPrice(target)) {
      return response.status(400).json({
        error: "Target must be integer cents or null."
      });
    }

    const result = await database.query(
      `UPDATE wishlist_items
       SET target_price_cents = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
       RETURNING id`,
      [target, response.locals.itemId, response.locals.userId]
    );

    if (!result.rows.length) {
      return response.status(404).json({
        error: "Item not found."
      });
    }

    response.json({ ok: true });
  });

  router.delete("/:id", async (_request, response) => {
    const result = await database.query(
      `UPDATE wishlist_items
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [response.locals.itemId, response.locals.userId]
    );

    if (!result.rows.length) {
      return response.status(404).json({
        error: "Item not found."
      });
    }

    response.json({ ok: true });
  });

  app.use("/api/wishlist", router);
}
