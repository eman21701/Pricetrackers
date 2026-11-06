# Changelog

## 0.9.0-beta (2026-11-05)

### Added

- Responsive PriceTrackers frontend with live Amazon and Walmart search,
  filtering, sorting, comparison basket, and light/dark themes.
- Email/password accounts with bcrypt password hashing and database-backed
  seven-day sessions.
- Database-backed wishlist CRUD, ownership checks, soft deletion, and target
  prices.
- Structured JSON operational logging with request and user correlation.
- Desktop and mobile Playwright journeys, Axe WCAG 2.1 A/AA audits, integration
  coverage thresholds, and k6 load/stress testing.
- CI artifacts for quality, integration, secret scanning, E2E, accessibility,
  and performance evidence.

### Changed

- Updated the service worker to use network-first asset refresh and to exclude
  API and health endpoints from its cache.
- Expanded CI to five independent release-verification jobs.
- Updated project documentation for the feature-complete beta.

### Security

- Replaced legacy password handling with bcrypt at cost 12 and enforced
  bcrypt's 72-byte password limit.
- Added parameterized database access, authenticated wishlist ownership
  checks, origin checks for state-changing wishlist requests, dependency
  auditing, and repository secret scanning.
- Verified the release dependency tree with zero reported npm vulnerabilities.

### Known limitations

- Google OAuth, password recovery, automatic target-price alerts, checkout,
  production HTTPS/cookie hardening, and rate limiting are outside this beta.
- Live results are retailer listings, not guaranteed product matches, and
  exclude tax and shipping.

## 0.1.0-alpha (2026-09-10)

### Added

- Containerized Express health endpoint.
- PostgreSQL readiness endpoint and environment configuration.
- Product search and stored-offer comparison endpoints.
- Repeatable synthetic product and offer seeds.
- Reversible product comparison schema.
