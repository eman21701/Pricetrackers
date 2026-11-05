import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";

const BCRYPT_COST = 12;
const BCRYPT_MAX_PASSWORD_BYTES = 72;

/**
 * @typedef {import("express").Express} ExpressApp
 * @typedef {import("./Database.js").Database} Database
 */

/**
 * Checks the required signup fields.
 * @param {string} name Account name.
 * @param {string} email Email address.
 * @param {string} password Account password.
 * @returns {boolean}
 */
function isValidSignup(name, email, password) {
  return (
    name.length >= 1 &&
    name.length <= 80 &&
    email.includes("@") &&
    password.length >= 8 &&
    Buffer.byteLength(password, "utf8") <= BCRYPT_MAX_PASSWORD_BYTES
  );
}

/**
 * Registers signup, login, logout, and current-user routes.
 * @param {ExpressApp} app Express application.
 * @param {Database} database Database access.
 */
export function registerAuth(app, database) {
  app.post("/api/auth/signup", async (request, response) => {
    const name = String(request.body?.name ?? "").trim();
    const email = String(request.body?.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(request.body?.password ?? "");

    if (!isValidSignup(name, email, password)) {
      return response.status(400).json({
        error:
          "Name, a valid email, and a password between 8 characters and 72 bytes are required.",
        code: "INVALID_ACCOUNT"
      });
    }

    const existing = await database.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return response.status(409).json({
        error: "An account with that email already exists.",
        code: "EMAIL_TAKEN"
      });
    }

    const passwordHash = await hashPassword(password);

    const created = await database.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, passwordHash]
    );

    await startSession(database, response, created.rows[0].id);
    response.locals.userId = created.rows[0].id;

    return response.status(201).json({
      user: created.rows[0]
    });
  });

  app.post("/api/auth/login", async (request, response) => {
    const email = String(request.body?.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(request.body?.password ?? "");

    const found = await database.query(
      `SELECT id, name, email, password_hash
       FROM users
       WHERE email = $1`,
      [email]
    );

    const user = found.rows[0];
    const matches =
      user?.password_hash &&
      (await verifyPassword(password, user.password_hash));

    if (!matches) {
      return response.status(401).json({
        error: "Email or password does not match.",
        code: "INVALID_LOGIN"
      });
    }

    await startSession(database, response, user.id);
    response.locals.userId = user.id;

    return response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  });

  app.get("/api/auth/me", async (request, response) => {
    const token = readCookie(request.headers.cookie, "pt_session");

    if (!token) {
      return response.json({
        user: null
      });
    }

    const found = await database.query(
      `SELECT u.id, u.name, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1
         AND s.expires_at > NOW()`,
      [token]
    );

    const currentUser = found.rows[0] ?? null;
    response.locals.userId = currentUser?.id ?? null;

    return response.json({ user: currentUser });
  });

  app.post("/api/auth/logout", async (request, response) => {
    const token = readCookie(request.headers.cookie, "pt_session");

    response.locals.userId = await getSessionUserId(
      database,
      request.headers.cookie
    );

    if (token) {
      await database.query("DELETE FROM sessions WHERE token = $1", [token]);
    }

    response.setHeader(
      "Set-Cookie",
      "pt_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    );

    return response.json({
      ok: true
    });
  });
}

/**
 * Hashes a password using bcrypt.
 * @param {string} password Plain password.
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Verifies a password against a stored bcrypt hash.
 * @param {string} password Plain password.
 * @param {string} stored Stored bcrypt hash.
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, stored) {
  if (
    typeof stored !== "string" ||
    !stored.startsWith("$2") ||
    Buffer.byteLength(password, "utf8") > BCRYPT_MAX_PASSWORD_BYTES
  ) {
    return false;
  }

  return bcrypt.compare(password, stored);
}

/**
 * Creates a seven-day session for a signed-in user.
 * @param {Database} database Database access.
 * @param {import("express").Response} response HTTP response.
 * @param {number} userId User identifier.
 * @returns {Promise<void>}
 */
async function startSession(database, response, userId) {
  const token = randomBytes(32).toString("hex");

  await database.query(
    `INSERT INTO sessions (token, user_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
    [token, userId]
  );

  response.setHeader(
    "Set-Cookie",
    `pt_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`
  );
}

/**
 * Reads a named value from a Cookie request header.
 * @param {string | undefined} header Cookie header.
 * @param {string} name Cookie name.
 * @returns {string | null}
 */
function readCookie(header, name) {
  if (!header) {
    return null;
  }

  const match = header
    .split(";")
    .find((part) => part.trim().startsWith(`${name}=`));

  return match ? match.trim().slice(name.length + 1) : null;
}

/**
 * Finds the signed-in user's ID from an unexpired session.
 * @param {Database} database Database access.
 * @param {string | undefined} cookieHeader Request cookies.
 * @returns {Promise<number | null>}
 */
export async function getSessionUserId(database, cookieHeader) {
  const token = readCookie(cookieHeader, "pt_session");

  if (!token) {
    return null;
  }

  const result = await database.query(
    `SELECT u.id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1
       AND s.expires_at > NOW()`,
    [token]
  );

  return result.rows[0]?.id ?? null;
}
