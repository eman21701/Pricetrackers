import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import knex from "knex";
import config from "../../knexfile.cjs";
import { Database } from "../../src/Database.js";
import { PriceTrackersApplication } from "../../src/server.js";

let database;
let server;
let baseUrl;
let createdUserId;

before(async () => {
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.PGDATABASE, "pricetrackers_test");
  assert.equal(process.env.PGHOST, "test-database");

  // These tests must not make paid retailer requests.
  process.env.SERPAPI_API_KEY = "";

  const setup = knex(config.development);

  try {
    await setup.migrate.latest();
    await setup.seed.run();
  } finally {
    await setup.destroy();
  }

  database = new Database();
  const application = new PriceTrackersApplication(database);

  // Port 0 lets the operating system choose an available test port.
  server = application.start(0);
  await once(server, "listening");

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
        server.closeAllConnections();
      });
    }
  } finally {
    if (database) {
      try {
        if (createdUserId) {
          await database.query("DELETE FROM users WHERE id = $1", [
            createdUserId
          ]);
        }
      } finally {
        await database.close();
      }
    }
  }
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    signal: AbortSignal.timeout(10000)
  });

  return {
    status: response.status,
    headers: response.headers,
    body: await response.json()
  };
}

function post(body) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

test("health and readiness report a working API and database", async () => {
  const health = await request("/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");

  const ready = await request("/ready");
  assert.equal(ready.status, 200);
  assert.equal(ready.body.database, "connected");
});

test("search finds headphones and returns their price comparison", async () => {
  const search = await request("/api/products?search=HEADPHONES");

  assert.equal(search.status, 200);
  assert.equal(search.body.count, 1);
  assert.equal(search.body.products[0].model, "DEMO-HEADPHONES-001");

  const id = search.body.products[0].id;
  const offers = await request(`/api/products/${id}/offers`);

  assert.equal(offers.status, 200);
  assert.equal(offers.body.product.id, id);
  assert.equal(offers.body.offers.length, 2);
  assert.deepEqual(offers.body.comparison, {
    currency: "USD",
    lowest_price_cents: 4999,
    lowest_price_retailers: ["Walmart"],
    price_difference_cents: 500
  });
});

test("search handles no matches and rejects overlong input", async () => {
  const empty = await request("/api/products?search=zz-no-match-zz");

  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.products, []);
  assert.equal(empty.body.count, 0);

  const invalid = await request(`/api/products?search=${"a".repeat(101)}`);

  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.code, "INVALID_SEARCH");
});

test("invalid IDs and missing endpoints return useful errors", async () => {
  const invalid = await request("/api/products/abc/offers");
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.code, "INVALID_PRODUCT_ID");

  const missing = await request("/api/products/2147483647/offers");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, "PRODUCT_NOT_FOUND");

  const endpoint = await request("/does-not-exist");
  assert.equal(endpoint.status, 404);
  assert.equal(endpoint.body.code, "NOT_FOUND");
});

test("signup, login, and logout persist and invalidate sessions", async () => {
  const account = {
    name: "Integration Test",
    email: `integration-${randomUUID()}@example.com`,
    password: "Test-only-password-123!"
  };

  const signup = await request("/api/auth/signup", post(account));

  assert.equal(signup.status, 201);
  createdUserId = signup.body.user.id;
  assert.ok(Number.isInteger(createdUserId));
  assert.equal(signup.body.user.email, account.email);
  assert.equal("password_hash" in signup.body.user, false);

  const signupCookie = signup.headers.get("set-cookie");
  assert.ok(signupCookie);
  assert.match(signupCookie, /HttpOnly/i);

  const stored = await database.query(
    "SELECT password_hash FROM users WHERE id = $1",
    [createdUserId]
  );
  assert.equal(stored.rows.length, 1);
  assert.ok(stored.rows[0].password_hash);
  assert.notEqual(stored.rows[0].password_hash, account.password);

  const duplicate = await request("/api/auth/signup", post(account));
  assert.equal(duplicate.status, 409);

  const wrongPassword = await request(
    "/api/auth/login",
    post({ email: account.email, password: "incorrect-password" })
  );
  assert.equal(wrongPassword.status, 401);

  const login = await request("/api/auth/login", post(account));
  assert.equal(login.status, 200);

  const loginCookie = login.headers.get("set-cookie");
  assert.ok(loginCookie);
  const cookie = loginCookie.split(";")[0];

  const current = await request("/api/auth/me", {
    headers: { Cookie: cookie }
  });
  assert.equal(current.status, 200);
  assert.equal(current.body.user.id, createdUserId);

  const wishlist = await request("/api/wishlist", {
    headers: { Cookie: cookie }
  });

  assert.equal(wishlist.status, 200);
  assert.deepEqual(wishlist.body.items, []);
  assert.equal(wishlist.body.count, 0);

  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: { Cookie: cookie }
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/i);

  // Even replaying the old cookie must no longer authenticate.
  const afterLogout = await request("/api/auth/me", {
    headers: { Cookie: cookie }
  });
  assert.equal(afterLogout.body.user, null);
});

test("live search reports missing configuration without contacting SerpAPI", async () => {
  const result = await request("/api/live-search?q=headphones");

  assert.equal(result.status, 503);
  assert.equal(result.body.code, "SEARCH_NOT_CONFIGURED");
});

test("wishlist rejects missing and invalid sessions", async () => {
  const anonymous = await request("/api/wishlist");

  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.body.code, "AUTH_REQUIRED");

  const invalid = await request("/api/wishlist", {
    headers: { Cookie: "pt_session=invalid-test-token" }
  });

  assert.equal(invalid.status, 401);
  assert.equal(invalid.body.code, "AUTH_REQUIRED");
});

test("wishlist supports CRUD, ownership checks, and soft deletion", async () => {
  const userIds = [];

  async function createAccount() {
    const signup = await request(
      "/api/auth/signup",
      post({
        name: "Wishlist Test",
        email: `wishlist-${randomUUID()}@example.com`,
        password: "Test-only-password-123!"
      })
    );

    assert.equal(signup.status, 201);
    userIds.push(signup.body.user.id);

    const cookie = signup.headers.get("set-cookie");
    assert.ok(cookie);
    return cookie.split(";")[0];
  }

  function authenticated(cookie, method, body) {
    return {
      method,
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    };
  }

  try {
    const ownerCookie = await createAccount();
    const otherCookie = await createAccount();

    const item = {
      retailer: "Amazon",
      external_id: "wishlist-test-product",
      title: "Synthetic Wishlist Test Product",
      price_cents: 4999,
      currency: "USD",
      link: "https://example.com/test-product",
      thumbnail: null
    };

    const saved = await request(
      "/api/wishlist",
      authenticated(ownerCookie, "POST", item)
    );

    assert.equal(saved.status, 200);
    const id = saved.body.id;
    assert.ok(Number.isInteger(id));

    const duplicate = await request(
      "/api/wishlist",
      authenticated(ownerCookie, "POST", item)
    );
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.id, id);

    const listed = await request("/api/wishlist", {
      headers: { Cookie: ownerCookie }
    });
    assert.equal(listed.status, 200);
    assert.equal(listed.body.count, 1);
    assert.equal(listed.body.items[0].title, item.title);

    const otherList = await request("/api/wishlist", {
      headers: { Cookie: otherCookie }
    });
    assert.equal(otherList.status, 200);
    assert.equal(otherList.body.count, 0);

    const forbiddenUpdate = await request(
      `/api/wishlist/${id}`,
      authenticated(otherCookie, "PATCH", {
        target_price_cents: 100
      })
    );
    assert.equal(forbiddenUpdate.status, 404);

    const forbiddenDelete = await request(
      `/api/wishlist/${id}`,
      authenticated(otherCookie, "DELETE")
    );
    assert.equal(forbiddenDelete.status, 404);

    const invalidTarget = await request(
      `/api/wishlist/${id}`,
      authenticated(ownerCookie, "PATCH", {
        target_price_cents: -1
      })
    );
    assert.equal(invalidTarget.status, 400);

    const updated = await request(
      `/api/wishlist/${id}`,
      authenticated(ownerCookie, "PATCH", {
        target_price_cents: 3999
      })
    );
    assert.equal(updated.status, 200);

    const updatedList = await request("/api/wishlist", {
      headers: { Cookie: ownerCookie }
    });
    assert.equal(updatedList.body.items[0].target_price_cents, 3999);

    const removed = await request(
      `/api/wishlist/${id}`,
      authenticated(ownerCookie, "DELETE")
    );
    assert.equal(removed.status, 200);

    const afterRemoval = await request("/api/wishlist", {
      headers: { Cookie: ownerCookie }
    });
    assert.equal(afterRemoval.body.count, 0);

    const stored = await database.query(
      "SELECT deleted_at FROM wishlist_items WHERE id = $1",
      [id]
    );
    assert.equal(stored.rows.length, 1);
    assert.ok(stored.rows[0].deleted_at);

    const restored = await request(
      "/api/wishlist",
      authenticated(ownerCookie, "POST", item)
    );
    assert.equal(restored.status, 200);
    assert.equal(restored.body.id, id);

    const restoredList = await request("/api/wishlist", {
      headers: { Cookie: ownerCookie }
    });
    assert.equal(restoredList.body.count, 1);
  } finally {
    // Remove only the disposable records created by this test.
    for (const userId of userIds) {
      await database.query("DELETE FROM wishlist_items WHERE user_id = $1", [
        userId
      ]);
      await database.query("DELETE FROM users WHERE id = $1", [userId]);
    }
  }
});
