import { randomUUID } from "node:crypto";

/**
 * Writes one structured JSON log entry.
 * @param {"info" | "warn" | "error"} level Log severity.
 * @param {string} message Human-readable event description.
 * @param {Record<string, unknown>} [details] Additional event fields.
 */
export function writeLog(level, message, details = {}) {
  const entry = {
    ...details,
    timestamp: new Date().toISOString(),
    level,
    message,
    request_id: details.request_id ?? null,
    user_id: details.user_id ?? null
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

/**
 * Adds a request ID and records the completed HTTP request.
 * @param {import("express").Request} request Incoming request.
 * @param {import("express").Response} response Outgoing response.
 * @param {import("express").NextFunction} next Express continuation.
 */
export function logRequest(request, response, next) {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();

  response.locals.requestId = requestId;
  response.setHeader("X-Request-ID", requestId);

  response.on("finish", () => {
    const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
    const durationMs = Number(elapsedNanoseconds) / 1_000_000;
    const level =
      response.statusCode >= 500
        ? "error"
        : response.statusCode >= 400
          ? "warn"
          : "info";

    writeLog(level, "HTTP request completed", {
      request_id: requestId,
      user_id: response.locals.userId ?? null,
      method: request.method,
      path: request.path,
      status_code: response.statusCode,
      duration_ms: Number(durationMs.toFixed(3))
    });
  });

  next();
}
