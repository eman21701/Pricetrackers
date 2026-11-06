# AI Usage & Verification Log

**Project Name:** PriceTrackers
**Team Name:** Team Trackers
**Team Lead:** Eric Woods (`@eman21701`)

**Team Members:**

- Eric Woods — Team Lead and System Architecture Development
- Katrina Nghambi — Backend/Frontend Development
- Tako Nyapadi — Testing and Quality Assurance

---

## Overview & AI Policy Compliance Statement

Our team used ChatGPT to generate initial code and configuration files, draft documentation, and troubleshoot errors.

---

## Entry 1: Prototype 1 — Backend & Local Development Setup

- **Date:** September 8, 2026
- **Team Member:** Eric Woods (`@eman21701`)
- **Tool Used:** ChatGPT
- **Associated Git Issue:** #1 — Set up local development environment
- **Associated Feature Branch:** `chore/local-development`
- **Assigned Peer Reviewer:** Katrina Nghambi

### Exact Prompt Submitted:

> “Can you help me create the initial PriceTrackers backend using JavaScript, Node.js, and Express? My GitHub repository currently contains a README and a Node .gitignore, and I have created the chore/local-development branch. Provide the package.json, src/server.js, Dockerfile, and docker-compose.yml files that are needed to run the backend through Docker. Start with a /health endpoint that returns JSON, then help me add PostgreSQL, environment-variable configuration, and a /ready endpoint that can verify that the database connection is working. Explain how to create the files and check that each step works.”

### AI Output Summary & Code Generated:

ChatGPT generated the initial `package.json`, `src/server.js`, `Dockerfile`, and `docker-compose.yml`. Later responses added PostgreSQL configuration, the `Database` class, and the `/ready` endpoint.

The `/health` endpoint checks whether the backend responds. The `/ready` endpoint checks whether the backend can query PostgreSQL.

### Human Review, Refactoring & Modifications Made:

- Created the files, installed dependencies through Docker, and configured local environment variables.
- WSL was installed and the computer restarted to resolve Docker’s startup problem.
- Ran the backend and checked its responses.
- Independent architecture and code review by Eric, Katrina and Tako.

### Verification & Testing Method:

- Ran `docker compose up --build -d`.
- Confirmed that the backend started and PostgreSQL reported healthy.
- Confirmed that `/health` returned `status: "ok"`.
- Confirmed that `/ready` returned `status: "ready"` and `database: "connected"`.
- Stopped PostgreSQL and confirmed that `/ready` reported database unavailability.
- Restarted PostgreSQL and confirmed recovery.

Evidence is recorded in issue #1.

---

## Entry 2: Prototype 1 — Database Migration, Rollback & Sample Data

- **Date:** September 8, 2026
- **Team Member:** Eric Woods (`@eman21701`)
- **Tool Used:** ChatGPT
- **Associated Git Issue:** #2 — Create database migrations and demo data
- **Associated Feature Branch:** `chore/local-development`
- **Assigned Peer Reviewer:** Katrina Nghambi
- **Assigned Independent Tester:** Tako Nyapadi

### Exact Prompt Submitted:

> “Help me create the initial PostgreSQL schema for PriceTrackers using Knex migrations. The backend and database are running through Docker Compose and we've already verified database connectivity. I want you to create tables for products, retailers, and offers, as well as include their relationships and constraints. Also provide knexfile.cjs and a migration with both up and down functions. I also want you to create a repeatable seed script that contains fictional products and synthetic Amazon and Walmart offers. Include examples where Walmart might be cheaper, Amazon is cheaper, and both prices are equal.”

### AI Output Summary & Code Generated:

ChatGPT generated:

- `knexfile.cjs`
- `migrations/001_initial_schema.cjs`
- `seeds/001_demo_data.cjs`
- Dockerfile updates to include migration and seed files

The migration creates `products`, `retailers`, and `offers`. Its `down` function removes the tables in dependency order.

The seed script adds three fictional products and six synthetic Amazon/Walmart offers. Prices are stored as integer cents.

### Human Review, Refactoring & Modifications Made:

- Added the generated files and installed Knex.
- Inspected table listings and sample records.
- Checked the expected prices and synthetic-data indicators.
- Reran the seed script to check for duplicate records.
- The schema constraints and repeatable seed logic were AI-generated.

### Verification & Testing Method:

- Ran `migrate:latest` and all three application tables were created.
- Ran `migrate:rollback` and the application tables were removed while Knex’s tracking tables remained.
- Reapplied the migration and the application tables were recreated.
- Ran the seed script twice.
- Confirmed totals remained at 3 products, 2 retailers, and 6 offers.
- Confirmed all six offers were marked synthetic.

Evidence is recorded in issue #2.

---

## Entry 3: Prototype 1 — Product Search & Price Comparison API

- **Date:** September 8, 2026
- **Team Member:** Eric Woods (`@eman21701`)
- **Tool Used:** ChatGPT
- **Associated Git Issue:** #3 — Implement product search and comparison API
- **Associated Feature Branch:** `chore/local-development`
- **Assigned Peer Reviewer:** Katrina Nghambi
- **Assigned Independent Tester:** Tako Nyapadi

### Exact Prompt Submitted:

> “Help me implement product search and offer comparison endpoints using the PriceTrackers database and synthetic data already created. Add a parameterized query method to Database.js, create ProductRepository.js for retrieving products and offers, and create ComparisonService.js for comparing prices. After that, I need you to update server.js with routes for searching products and retrieving a selected product's offers. Include input validation, responses for missing products, and handling for equal prices. keep prices in integer cents for now.”

### AI Output Summary & Code Generated:

ChatGPT generated `ProductRepository.js`, `ComparisonService.js`, a parameterized query method in `Database.js`, and updated routes in `server.js`.

The API supports:

- `GET /api/products`
- `GET /api/products?search=...`
- `GET /api/products/:id/offers`

The comparison logic identifies the lowest price, returns both retailers for a tie, and calculates the difference between the highest and lowest stored item prices.

### Human Review, Refactoring & Modifications Made:

- Added the classes and updated the server.
- Two new files were initially placed in nested folders under `seeds`, causing missing-module errors.
- Moved those files into the main `src` folder using AI troubleshooting guidance.
- Rebuilt the backend and compared browser responses with the expected sample data.

### Verification & Testing Method:

- Headphone search returned the expected product.
- Headphone comparison identified Walmart at 4999 cents and Amazon at 5499 cents, with a 500-cent difference.
- Charger comparison returned both retailers at 1999 cents with a zero difference.
- A search with no matches returned an empty array.
- An invalid ID returned `INVALID_PRODUCT_ID`.
- A nonexistent product returned `PRODUCT_NOT_FOUND`.

Evidence is recorded in issue #3.

---

## Entry 4: Prototype 1 — Automated Tests, Code Checks & CI

- **Date:** September 9, 2026
- **Team Member:** Eric Woods (`@eman21701`)
- **Tool Used:** ChatGPT
- **Associated Git Issue:** #4 — Configure automated checks
- **Associated Feature Branch:** `chore/local-development`
- **Assigned Independent Tester:** Tako Nyapadi

### Exact Prompt Submitted:

> “I need help with adding automated verification for PriceTrackers now that product search and comparison are working. I need you to help create some unit tests for ComparisonService using Node.js's built-in test runner. Cover lower price selection, equal prices, empty offers, single offers, zero prices, invalid prices, unsupported currencies, and preserve input data. Add ESLint and Prettier configuration with commands for running checks through Docker. Walk me through the steps on how to create a GitHub Actions workflow that runs linting, formatting checks, unit tests, and secret scanning on pushes and pull requests.”

### AI Output Summary & Code Generated:

ChatGPT generated:

- Nine `ComparisonService` unit tests
- npm test and code-quality scripts
- ESLint and Prettier configuration
- `.github/workflows/ci.yml`
- A Gitleaks secret-scanning job
- Workflow artifact-upload steps

### Human Review, Refactoring & Modifications Made:

- Installed the tools and ran the checks.
- The initial AI-provided test command failed to load the test directory as intended. Eric changed it to the explicit test filename following corrected guidance.
- Saved an initially unsaved `package.json` and reran the tests.
- ESLint was upgraded from version 9 to version 10 after an unsupported-version warning.
- Prettier automatically reformatted project files.
- The first uploaded workflow omitted the secret-scanning job. Eric replaced it with the complete workflow.
- GitHub action versions were updated after a runtime deprecation warning.
- Tako’s independent test execution and review of test coverage are pending.

### Verification & Testing Method:

- Unit tests: 9 passed, 0 failed, 0 skipped.
- ESLint 10: passed.
- Prettier formatting check: passed.
- GitHub Actions quality job: passed.
- GitHub Actions secret-scan job: passed.
- Both jobs uploaded verification logs.
- PR #7 displayed successful checks.

Verified push run:

https://github.com/eman21701/Pricetrackers/actions/runs/34455914493

The unit tests cover comparison logic. These results do not establish complete API, database integration, security, or end-to-end coverage.

Evidence is recorded in issue #4.

---

## Audit Certification

I certify as Team Lead that all entries above accurately represent AI usage within this project phase, all prompts have been recorded, and all code has been validated by human review and automated testing.

**Team Lead Signature:** Eric Woods
**Date:** 9/10/2026

## Entry 5: Prototype 2 — Live search, accounts, and submission controls

- **Date:** October 4, 2026
- **Team Member:** Katrina Nghambi
- **Tool Used:** ChatGpt
- **Associated Git Issue:** Prototype 2 Alpha verification
- **Assigned Peer Reviewer:** Eric Woods
- **Assigned Independent Tester:** Tako Nyapadi

### Exact Prompt Submitted:

> Help connect the PriceTrackers frontend to the Express API, add email signup and login stored in PostgreSQL, and map the Prototype 2 requirements for the Alpha demo, security review, and CI logs.

### AI Output Summary & Code Generated:

Drafted the live-search route, the session-based auth module, the frontend, the users and sessions migration, and the Prototype 2 requirement map.

### Human Review, Refactoring & Modifications Made:

- The API key was placed in `.env` and passed through Docker Compose, not committed.
- Signup was verified with `Invoke-RestMethod` and returned user id 1 without a password.
- CI failures for missing imports, implicit `any`, and Prettier were fixed before merge.
- Wishlist remains local and is not claimed as a database feature yet.
- Google OAuth was not enabled for this tag.

### Verification & Testing Method:

- `GET /health` returned ok.
- `GET /api/live-search?q=blender` returned priced Walmart rows.
- Signup and login returned the user and stored a session.
- GitHub Actions quality and secret-scan logs are attached to the Prototype 2 issue.

## Entry 6: Prototype 3 — Authentication and dependency hardening

- **Date:** November 5, 2026
- **Team Member:** Eric Woods (`@eman21701`)
- **Tool Used:** ChatGPT
- **Associated Git Issue:** Prototype 3 QA execution and bug log

### Exact Prompt Submitted:

> “I want some help with the authentication and dependency setup for
> Prototype 3. I want you to review the current password storage against the project
> requirements, replace the legacy password handling with bcrypt, enforce safe
> password limits, and add regression coverage for both signup and login."

### AI output and changes

ChatGPT separated dependency audit findings from the passing integration and secret-scan jobs,
and proposed non-forced package updates. It also reviewed the password implementation against the requirement and drafted the bcrypt conversion, 72-byte validation, and regression checks.

### Human review and verification

- Eric reviewed and saved `Auth.js`, `package.json`, and `package-lock.json`.
- The bcrypt cost and password boundary were inspected in source.
- Signup stored a non-plaintext bcrypt hash.
- Correct and incorrect password cases were exercised.
- `npm audit --audit-level=low` completed with zero vulnerabilities.
- The full quality and integration jobs later passed in GitHub Actions.

---

## Entry 7: Prototype 3 — Structured logging and integration coverage

- **Date:** November 5, 2026
- **Team Member:** Eric Woods (`@eman21701`)
- **Tool Used:** ChatGPT
- **Associated Git Issue:** Prototype 3 QA execution and bug log

### Consolidated Prompt Submitted:

> “I need some help figuring out the operational logging and integration-test
> requirements. I want you to add structured JSON logging with a timestamp, log level,
> request ID, user ID, HTTP status, and duration, including safe handling for
> unexpected errors. Add a focused logger unit test, then expand the existing
> API integration test to cover health and readiness, authentication, session
> invalidation, wishlist CRUD and ownership, soft deletion and restoration,
> missing live-search configuration, migrations, repeatable seeds, and useful
> error responses. The tests must use an isolated database and must not make
> paid retailer requests.”

### AI output and changes

ChatGPT assisted in drafting `Logger.js`, request-correlation middleware, error logging,
logger unit coverage, and expanded API integration coverage. The test changes
covered authentication, session invalidation, wishlist ownership, soft
deletion/restoration, missing retailer configuration, operational probes, and
useful error responses.

### Human review and verification

- Eric checked that logs contain timestamp, level, request ID, user ID, status,
  and duration without passwords or session tokens.
- ESLint, type checking, and formatting passed.
- Ten unit tests passed.
- The combined isolated database run completed 19 tests with no failures.
- Health, readiness, migrations, repeatable seeds, and account-backed wishlist
  behavior were observed in the integration output.

---

## Entry 8: Prototype 3 — E2E, accessibility, and performance QA

- **Date:** November 5, 2026
- **Team Member:** Eric Woods (`@eman21701`)
- **Tool Used:** ChatGPT
- **Associated Git Issue:** Prototype 3 QA execution and bug log

### Consolidated Prompt Submitted:

> “Help me add complete end-to-end, accessibility, and performance testing for
> our beta. I want you to create Playwright journeys for desktop and mobile
> that covers things like search, filters, the basket, account creation, login/logout, and a
> database-backed wishlist while replacing live retailer requests with a
> deterministic fixture. Add Axe checks for WCAG 2.1 A and AA, keyboard
> navigation, accessible names, dialogs, forms, and landmarks. Also add a k6
> load-and-stress test with latency and failure thresholds and
> upload all evidence through GitHub Actions.”

### AI output and changes

ChatGPT assisted in drafting Playwright desktop/mobile journeys, deterministic retailer
fixtures, accessibility scans, keyboard and semantic assertions, k6 load/stress
configuration, and CI artifact steps. It diagnosed duplicate form controls,
missing labels, and contrast failures and proposed targeted HTML/CSS/test
corrections.

### Human review and verification

- Eric saved and formatted the generated files and reran each failed case.
- E2E progressed from 4 failed/6 passed, to 2 failed/8 passed, to 1 failed/9
  passed, and finally 10 passed.
- Final Axe artifacts contained zero automated WCAG 2.1 A/AA violations.
- Keyboard navigation, dialog names, form labels, navigation landmarks, and
  screen-reader control names passed in both projects.
- The k6 scenario passed its check, failed-request, and p95 latency thresholds.
- GitHub Actions uploaded Playwright, accessibility, and performance evidence.

## Final Prototype 3 certification

After the final CI run and tag verification, the Team Lead should certify that
the prompt record is complete, the AI-assisted output was reviewed, and all
claimed tests correspond to retained evidence.

**Team Lead Signature:** Eric Woods  
**Certification date:** November 5, 2026
**Release evidence:** The `v0.9.0-beta` GitHub Release must link the final
commit, QA issue, and successful workflow run.
