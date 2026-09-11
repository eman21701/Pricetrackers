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
- Corrected Docker Compose indentation using AI troubleshooting guidance.
- WSL was installed and the computer restarted to resolve Docker’s startup problem.
- Ran the backend and checked its responses.
- Independent architecture and code review by Eric and Katrina.

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

I certify as Team Lead that all entries above accurately represent AI usage within this project phase, all prompts have ben recorded, and all code has been validated by human review and automated testing.

**Team Lead Signature:** Eric Woods
**Date:** 9/10/2026
