import test from "node:test";
import assert from "node:assert/strict";
import { writeLog } from "../../src/Logger.js";

test("writes structured JSON with required operational fields", (context) => {
  const messages = [];

  context.mock.method(console, "log", (message) => {
    messages.push(message);
  });

  writeLog("info", "Test event", {
    request_id: "request-123",
    user_id: 42
  });

  assert.equal(messages.length, 1);

  const entry = JSON.parse(messages[0]);
  assert.equal(entry.level, "info");
  assert.equal(entry.message, "Test event");
  assert.equal(entry.request_id, "request-123");
  assert.equal(entry.user_id, 42);
  assert.ok(!Number.isNaN(Date.parse(entry.timestamp)));
});
