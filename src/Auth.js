import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

/**
 * @typedef {import("express").Express} ExpressApp
 * @typedef {import("./Database.js").Database} Database
 */

/**
 * Registers signup, login, and current-user routes.
 * @param {ExpressApp} app Express application.
 * @param {Database} database Database access.
 */
export function registerAuth(app, database) {
  app.post("/api/auth/signup", async (request, response) => {
    const name = String(request.body?.name ?? "").trim();
    const email = String(request.body?.email ?? "").trim().toLowerCase();
    const password = String(request.body?.password ?? "");

    if (name.length < 1 || name.length > 80 || !email.includes("@") || password.length < 8) {
      return response.status(400).json({
        error: "Name, a valid email, and a password of at least 8 characters are required.",
        code: "INVALID_ACCOUNT"
      });
    }

    const existing = await database.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return response.status(409).json({
        error: "An account with that email already exists.",
        code: "EMAIL_TAKEN"
      });
    }

    const created = await database.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, await hashPassword(password)]
    );
    await startSession(database, response, created.rows[0].id);
    response.status(201).json({ user: created.rows[0] });
  });

  app.post("/api/auth/login", async (request, response) => {
    const email = String(request.body?.email ?? "").trim().toLowerCase();
    const password = String(request.body?.password ?? "");
    const found = await database.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [email]
    );
    const user = found.rows[0];
    const matches = user?.password_hash && (await verifyPassword(password, user.password_hash));

    if (!matches) {
      return response.status(401).json({
        error: "Email or password does not match.",
        code: "INVALID_LOGIN"
      });
    }

    await startSession(database, response, user.id);
    response.json({ user: { id: user.id, name: user.name, email: user.email } });
  });

  app.get("/api/auth/me", async (request, response) => {
    const token = readCookie(request.headers.cookie, "pt_session");
    if (!token) return response.json({ user: null });

    const found = await database.query(
      `SELECT u.id, u.name, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );
    response.json({ user: found.rows[0] ?? null });
  });

app.post("/api/auth/logout", async (request, response) => {
  const token = readCookie(request.headers.cookie, "pt_session");
  if (token) await database.query("DELETE FROM sessions WHERE token = $1", [token]);
  response.setHeader("Set-Cookie", "pt_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  response.json({ ok: true });
});

}

/**
 * @param {string} password Plain password.
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

/**
 * @param {string} password Plain password.
 * @param {string} stored Stored salt and hash.
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = Buffer.from(hash, "hex");
  const expected = await scrypt(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * @param {Database} database Database access.
 * @param {import("express").Response} response HTTP response.
 * @param {number} userId User id.
 */
async function startSession(database, response, userId) {
  const token = randomBytes(32).toString("hex");
  await database.query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')",
    [token, userId]
  );
  response.setHeader(
    "Set-Cookie",
    `pt_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`
  );
}

/**
 * @param {string | undefined} header Cookie header.
 * @param {string} name Cookie name.
 * @returns {string | null}
 */
function readCookie(header, name) {
  if (!header) return null;
  const match = header.split(";").find((part) => part.trim().startsWith(`${name}=`));
  return match ? match.trim().slice(name.length + 1) : null;
}
