# PriceTrackers

PriceTrackers is our Senior Design II project. Our goal is to help users
compare prices from Amazon and Walmart in one place.

For Prototype 3, we have a feature-complete beta with a responsive frontend,
live retailer search, user accounts, database-backed wishlists, automated
testing, accessibility checks, and performance testing.

Live results are separate retailer listings and may not be the exact same
product. The prices do not include tax or shipping, so users should verify the
item on the retailer's website before buying.

## What works so far

- Searching Amazon and Walmart through SerpAPI
- Searching the stored synthetic product catalog by name, brand, or model
- Sorting and filtering results by retailer, price, rating, and sponsored status
- Showing the lowest visible price on the comparison ruler
- Creating an account and signing in with an email and password
- Logging out and invalidating the database session
- Saving, updating, and removing database-backed wishlist items
- Setting a target price for a wishlist item
- Adding listings to a local comparison basket
- Switching between light and dark themes
- Checking whether the API and database are working
- Writing structured JSON request logs
- Running automated unit, integration, desktop, mobile, accessibility,
  security, and performance checks

Prototype 3 is under feature freeze. New features are being saved for future
work so the beta can remain stable for testing and demonstration.

## Tools we are using

- JavaScript and Node.js 24 for the backend
- Express for API endpoints
- PostgreSQL 17 for the database
- Knex for database migrations and sample data
- bcrypt for password hashing
- HTML, CSS, and JavaScript for the frontend
- SerpAPI for Amazon and Walmart search results
- Docker Compose for local services and isolated test environments
- Node's built-in test runner for unit and integration tests
- Playwright and Axe for desktop, mobile, and accessibility testing
- k6 for load and stress testing
- GitHub Actions for tests, code checks, secret scanning, and saved logs

## Setting up the project

You will need Git, Docker Desktop, and access to this repository.

On Windows, Docker Desktop needs WSL 2 configured. Open Docker Desktop before
starting. You do not need to install Node.js or PostgreSQL separately when
using the Docker commands below.

Run these commands in PowerShell:

```powershell
git clone https://github.com/eman21701/Pricetrackers.git
cd Pricetrackers
git switch release/prototype3-beta
Copy-Item .env.example .env
```

Open `.env` and fill in these settings:

| Setting             | What to enter                                                   |
| ------------------- | --------------------------------------------------------------- |
| `POSTGRES_DB`       | `pricetrackers`                                                 |
| `POSTGRES_USER`     | `pricetrackers`                                                 |
| `POSTGRES_PASSWORD` | Your own local development password                             |
| `SERPAPI_API_KEY`   | Your SerpAPI key, or leave blank when live search is not needed |

Do not upload `.env` to GitHub. The `.env.example` file is the template that
teammates can use. The SerpAPI key stays on the backend and should never be
added to frontend code.

The PostgreSQL password is used when the database is first created. Changing
it in `.env` later does not change the password in an existing database
volume.

Start the backend and database:

```powershell
docker compose up --build -d
```

Create or update the database tables:

```powershell
docker compose exec backend npx knex --knexfile knexfile.cjs migrate:latest
```

Add the sample products and prices:

```powershell
docker compose exec backend npx knex --knexfile knexfile.cjs seed:run
```

Check that everything started:

```powershell
docker compose ps
```

The backend should say it is running, and the database should say healthy.

In a second PowerShell window, start the frontend:

```powershell
docker run --rm --name pricetrackers-frontend -p 127.0.0.1:4173:4173 --mount "type=bind,source=$($PWD.Path),target=/app" -w /app node:24-bookworm-slim sh -c "npm ci && npm run serve:frontend"
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173) to use PriceTrackers.

The backend at port 3000 only serves the API. Opening
`http://127.0.0.1:3000/` by itself returns the expected `NOT_FOUND` response.

## Trying the application and API

Open these addresses in your browser:

| Address                                                                                                      | What it does                                      |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| [http://127.0.0.1:4173](http://127.0.0.1:4173)                                                               | Opens the PriceTrackers frontend                  |
| [http://localhost:3000/health](http://localhost:3000/health)                                                 | Checks whether the backend responds               |
| [http://localhost:3000/ready](http://localhost:3000/ready)                                                   | Checks whether the backend can reach the database |
| [http://localhost:3000/api/products](http://localhost:3000/api/products)                                     | Lists the stored sample products                  |
| [http://localhost:3000/api/products?search=headphones](http://localhost:3000/api/products?search=headphones) | Searches the stored catalog for headphones        |

To see a stored product's offers, use:

```text
http://localhost:3000/api/products/PRODUCT_ID/offers
```

Replace `PRODUCT_ID` with the ID shown in the search results.

Prices in API responses are stored as integer cents. For example, `4999`
means `$49.99`. The `is_synthetic` field identifies our made-up sample offers.

The main frontend uses `/api/live-search` for Amazon and Walmart results. If
`SERPAPI_API_KEY` is blank, the endpoint returns `SEARCH_NOT_CONFIGURED`
without making a retailer request.

## Sample data

| Product                  | Walmart | Amazon | Expected result    |
| ------------------------ | ------: | -----: | ------------------ |
| Demo Wireless Headphones |  $49.99 | $54.99 | Walmart is cheaper |
| Demo Coffee Maker        |  $34.99 | $29.99 | Amazon is cheaper  |
| Demo USB-C Charger       |  $19.99 | $19.99 | Same price         |

A new database with the sample data should have 3 products, 2 retailers, and
6 offers. Running the seed command again should not add duplicates.

The sample offers are used for repeatable API, integration, and performance
tests. They are not current retailer prices.

## How the code is organized

| File or folder             | What it is for                                                        |
| -------------------------- | --------------------------------------------------------------------- |
| `frontend/`                | Contains the webpage, styles, scripts, icons, and service worker      |
| `src/server.js`            | Configures Express, health checks, catalog routes, and error handling |
| `src/Database.js`          | Manages database connections and parameterized queries                |
| `src/Auth.js`              | Handles signup, login, logout, and sessions                           |
| `src/Wishlist.js`          | Handles authenticated wishlist operations                             |
| `src/LiveSearch.js`        | Retrieves and normalizes SerpAPI retailer results                     |
| `src/ProductRepository.js` | Gets stored products and offers from PostgreSQL                       |
| `src/ComparisonService.js` | Finds the lowest stored price and handles ties                        |
| `src/Logger.js`            | Writes structured JSON logs and request IDs                           |
| `migrations/`              | Creates and removes database tables                                   |
| `seeds/`                   | Adds repeatable synthetic products and prices                         |
| `tests/unit/`              | Tests comparison and logging code                                     |
| `tests/integration/`       | Tests the API, database, accounts, and wishlists                      |
| `tests/e2e/`               | Tests desktop/mobile user journeys and accessibility                  |
| `tests/performance/`       | Contains the k6 load and stress benchmark                             |
| `.github/workflows/ci.yml` | Runs the five GitHub Actions verification jobs                        |

The database contains `products`, `retailers`, `offers`, `users`, `sessions`,
and `wishlist_items`. The detailed relationships and ER diagram are in the
[Developer Guide](docs/DEVELOPER_GUIDE.md).

## Running the tests and checks

Run these commands from the project folder in PowerShell.

Install the development dependencies:

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/app" -w /app node:24-bookworm-slim npm ci
```

Run the unit tests:

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/app" -w /app node:24-bookworm-slim npm test
```

Check the JavaScript code:

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/app" -w /app node:24-bookworm-slim npm run lint
```

Check the JavaScript types:

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/app" -w /app node:24-bookworm-slim npm run typecheck
```

Check formatting:

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/app" -w /app node:24-bookworm-slim npm run format:check
```

Check dependencies:

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/app" -w /app node:24-bookworm-slim npm audit --audit-level=low
```

The beta currently has 10 unit tests. The verified combined unit and
integration run completed 19 tests.

Run the isolated integration tests:

```powershell
docker compose -p pricetrackers-tests -f compose.test.yml run --rm test-runner
docker compose -p pricetrackers-tests -f compose.test.yml down --volumes --remove-orphans
```

Run the desktop and mobile Playwright tests:

```powershell
docker compose -p pricetrackers-e2e -f compose.e2e.yml run --rm e2e-runner
docker compose -p pricetrackers-e2e -f compose.e2e.yml down --volumes --remove-orphans
```

The Playwright suite runs five tests in desktop Chromium and five tests in
mobile Chromium, for 10 total. It includes automated WCAG 2.1 A and AA scans,
keyboard navigation, screen-reader names, search, basket, account, and
database-backed wishlist checks.

Run the k6 load and stress benchmark:

```powershell
New-Item -ItemType Directory -Force artifacts/performance | Out-Null
docker compose -p pricetrackers-performance -f compose.performance.yml run --rm performance-runner
docker compose -p pricetrackers-performance -f compose.performance.yml down --volumes --remove-orphans
```

The performance test ramps from 5 to 20 virtual users and checks health,
readiness, stored search, failed requests, and response times.

GitHub Actions runs five jobs:

1. Linting, type checking, formatting, unit tests, and dependency audit
2. Integration tests and coverage
3. Secret scanning
4. Desktop/mobile Playwright and accessibility tests
5. k6 load and stress testing

Each job uploads logs or reports that can be downloaded from the successful
workflow run.

## Testing database rollback

Rollback removes application tables and the data stored in them. Only do this
with a local test database whose data you can replace.

```powershell
docker compose exec backend npx knex --knexfile knexfile.cjs migrate:rollback
```

To restore the tables and sample data, run `migrate:latest` and `seed:run`
again.

## If something does not start

Make sure Docker Desktop is running and your files are saved.

Check the containers and backend logs:

```powershell
docker compose ps -a
docker compose logs --tail=80 backend
```

After editing backend code, rebuild it:

```powershell
docker compose up --build -d
```

If the frontend shows an older version, hard-refresh the page or unregister
the PriceTrackers service worker in the browser developer tools. The current
service worker uses network-first loading and does not cache API endpoints.

Accounts created before the bcrypt update may not be able to sign in. Because
password recovery is not part of this beta, use a new disposable test account
instead of weakening password verification.

To stop the main project:

```powershell
docker compose down
```

This keeps the database data. Adding `--volumes` deletes that data.

## Project documentation

Additional project documentation is available here:

- [Developer Guide](docs/DEVELOPER_GUIDE.md) - architecture, database ERD,
  dependencies, testing, and maintenance information
- [Security Notes](docs/SECURITY.md) - implemented controls and known beta risks
- [Accessibility Audit](docs/ACCESSIBILITY_AUDIT.md) - WCAG 2.1 A and AA results
- [QA Test and Bug Log](docs/QA_TEST_LOG.md) - edge cases, severity, and resolution status
- [Team Lead Audit](docs/TEAM_LEAD_AUDIT.md) - final requirement and release review
- [Prototype 3 Demo Script](docs/DEMO_SCRIPT.md) - timed 8–10 minute walkthrough
- [Changelog](CHANGELOG.md) - summary of notable project changes
- [AI Usage & Verification Log](AI_USAGE_LOG.md) - record of AI-assisted work and verification

## Working as a team

We use GitHub Issues to track tasks, test findings, and bugs. Changes are made
on branches and submitted through pull requests for review.

Commit messages use prefixes such as `feat:`, `fix:`, `test:`, `docs:`, and
`chore:`. Pull requests should reference the issues they address.

For Prototype 3, findings include a severity level, resolution status, and
verification evidence. A finding is not marked resolved until its regression
test and the complete GitHub Actions workflow pass.

## AI use

We used ChatGPT to help plan the prototype, generate initial code and tests,
draft documentation, and troubleshoot setup problems. AI-generated work was
reviewed and verified by running the application locally, checking API
responses, testing database migrations and rollback, and running automated
tests and code checks.

Our AI prompts, changes, and verification results are recorded in
[AI_USAGE_LOG.md](AI_USAGE_LOG.md).

## What is not finished yet

The following items are outside the Prototype 3 beta:

- Google sign-in
- Forgotten-password recovery
- Automatic target-price alerts
- Checkout or payment processing
- Product identity matching between Amazon and Walmart listings
- Price-history charts
- Public production deployment and production security hardening

The local beta does not include HTTPS, secure production cookies, rate
limiting, or a managed secrets platform. These items must be completed before
the application could be considered for public production use.
