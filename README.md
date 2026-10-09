# PriceTrackers

PriceTrackers is our Senior Design II project. Our goal is to help users
search for products, compare prices from Amazon and Walmart, and save items
they want to buy later.

For Prototype 2, we added a working frontend, user accounts, and wishlists.
We still use made-up products and prices to test our original comparison API.
We also added live retailer searches through SerpAPI. We are not scraping
Amazon or Walmart directly.

## What works so far

- Searching Amazon and Walmart product results through the frontend
- Sorting and filtering results by price, rating, or retailer
- Creating an account, signing in, and signing out
- Saving products to an account's wishlist
- Setting a target price and removing wishlist items
- Adding products to a local basket (not an actual checkout)
- Searching our sample products by name, brand, or model through the API
- Comparing the sample Amazon and Walmart offers to find the lower price
- Checking whether the server and database are working
- Creating database tables and adding sample data without duplicates
- Running automated unit, integration, code quality, and security checks

Prices do not include tax or shipping. Live search results from different
retailers are not automatically matched as the exact same product yet.

## Tools we are using

- HTML, CSS, and JavaScript for the frontend
- JavaScript and Node.js 24 for the backend
- Express for API endpoints
- PostgreSQL 17 for the database
- Knex for database migrations and sample data
- SerpAPI for live Amazon and Walmart search results
- Docker Compose to run the backend and database together
- GitHub Actions to run tests, code checks, and security scans

## Setting up the project

You will need Git, Docker Desktop, and access to this repository.
On Windows, Docker Desktop needs WSL 2 configured.

Open Docker Desktop before starting. You do not need to install Node.js
or PostgreSQL separately when using the Docker commands below.

Run these commands in PowerShell:

```powershell
git clone https://github.com/eman21701/Pricetrackers.git
cd Pricetrackers
Copy-Item .env.example .env
```

Open `.env` and check these settings:

| Setting | What to enter |
| --- | --- |
| `POSTGRES_DB` | `pricetrackers` |
| `POSTGRES_USER` | `pricetrackers` |
| `POSTGRES_PASSWORD` | Your own local development password |
| `SERPAPI_API_KEY` | Your SerpAPI key, if you want live search |

For live search, add `SERPAPI_API_KEY=your_key_here` to `.env`. The current
`.env.example` includes `API_UNIT_KEY`, but the live-search code expects
`SERPAPI_API_KEY`. You can replace that unused example setting.

Do not upload `.env` or any API keys to GitHub. The `.env.example` file is
only a template for teammates to use.

The database password is set when PostgreSQL is first created. Changing it
in `.env` later does not change the password in an existing database.

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

The backend should be running, and the database should say `healthy`.

## Starting the frontend

The frontend is in the `frontend/` folder. It runs in your browser and
connects to the backend on port 3000.

If Python is installed, open a second PowerShell terminal in the project
folder and run:

```powershell
py -m http.server 4173 --directory frontend --bind 127.0.0.1
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173) in your browser.
Keep both the backend and frontend running while using the application.

Use `127.0.0.1` for the frontend because that is the address currently
configured in `frontend/app.js` for the backend connection.

You can search for products, create an account, and save wishlist items.
Live retailer searches require a working SerpAPI key and available API
requests. The basket is saved in the browser; account wishlists are saved
in PostgreSQL.

## Trying the API

Open these addresses in your browser:

| Address | What it does |
| --- | --- |
| [http://127.0.0.1:3000/health](http://127.0.0.1:3000/health) | Checks whether the backend responds |
| [http://127.0.0.1:3000/ready](http://127.0.0.1:3000/ready) | Checks the database connection |
| [http://127.0.0.1:3000/api/products](http://127.0.0.1:3000/api/products) | Lists the sample products |
| [http://127.0.0.1:3000/api/products?search=headphones](http://127.0.0.1:3000/api/products?search=headphones) | Searches the sample data |
| [http://127.0.0.1:3000/api/live-search?q=headphones](http://127.0.0.1:3000/api/live-search?q=headphones) | Gets live search results when SerpAPI is configured |

To see a sample product's offers, use:

```text
http://127.0.0.1:3000/api/products/PRODUCT_ID/offers
```

Replace `PRODUCT_ID` with an ID shown in the products response.

The backend also has `/api/auth/` endpoints for signup, login, logout,
and checking the current user. The `/api/wishlist` endpoints let signed-in
users add, view, update, and remove their saved items. The frontend uses
these endpoints automatically.

Prices in the API are in cents. For example, `4999` means $49.99.
The `is_synthetic` field identifies our made-up offers.

## Sample data

| Product | Walmart | Amazon | Expected result |
| --- | ---: | ---: | --- |
| Demo Wireless Headphones | $49.99 | $54.99 | Walmart is cheaper |
| Demo Coffee Maker | $34.99 | $29.99 | Amazon is cheaper |
| Demo USB-C Charger | $19.99 | $19.99 | Same price |

A new database with the sample data should have 3 products, 2 retailers,
and 6 offers. Running the seed command again should not add duplicates.

## How the code is organized

| File or folder | What it is for |
| --- | --- |
| `frontend/` | Web pages, styles, and frontend JavaScript |
| `src/server.js` | Sets up Express and API routes |
| `src/Auth.js` | Handles accounts, passwords, and sessions |
| `src/Wishlist.js` | Handles saved wishlist items |
| `src/LiveSearch.js` | Gets live search results through SerpAPI |
| `src/Database.js` | Manages database connections and queries |
| `src/ProductRepository.js` | Gets sample products and offers from the database |
| `src/ComparisonService.js` | Finds the lowest sample price and handles ties |
| `migrations/` | Creates and removes database tables |
| `seeds/` | Adds sample products and prices |
| `tests/unit/` | Tests comparison logic |
| `tests/integration/` | Tests the API, accounts, wishlists, and database |
| `.github/workflows/ci.yml` | Runs GitHub Actions checks |

The database now has six tables: `products`, `retailers`, `offers`,
`users`, `sessions`, and `wishlist_items`. Wishlist items belong to a
specific user and use a `deleted_at` timestamp when removed.

## Running the tests and checks

Run these commands from the project folder in PowerShell.

If you do not have Node.js installed locally, install development
dependencies with Docker:

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/app" -w /app node:24-bookworm-slim npm ci
```

Run the nine unit tests:

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/app" -w /app node:24-bookworm-slim npm test
```

Check the code, JavaScript types, and formatting:

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/app" -w /app node:24-bookworm-slim npm run lint
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/app" -w /app node:24-bookworm-slim npm run typecheck
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/app" -w /app node:24-bookworm-slim npm run format:check
```

To run the unit and integration tests with a separate test database:

```powershell
docker compose -p pricetrackers-tests -f compose.test.yml up -d --wait test-database
docker compose -p pricetrackers-tests -f compose.test.yml run --rm test-runner
docker compose -p pricetrackers-tests -f compose.test.yml down --volumes
```

These tests cover the API, database migrations, account sessions, and
wishlist operations. GitHub Actions also checks code complexity, runs
`npm audit`, scans for secrets, and checks that backend test coverage
meets at least 60% for lines, branches, and functions.

Test results and logs are available in the repository's **Actions** tab.

## Testing database rollback

Rollback removes database tables from the latest migration batch. This
can delete application data, so only use it with a local test database.

```powershell
docker compose exec backend npx knex --knexfile knexfile.cjs migrate:rollback
```

To restore the tables and sample data, run the migration and seed
commands from the setup section again.

## If something does not start

Make sure Docker Desktop is running and your files are saved.

Check the containers and backend logs:

```powershell
docker compose ps -a
docker compose logs --tail=80 backend
```

After editing backend code or migrations, rebuild it:

```powershell
docker compose up --build -d
```

If live search does not work, make sure `SERPAPI_API_KEY` is set in `.env`
and restart the backend. A missing key causes a `SEARCH_NOT_CONFIGURED`
response.

To stop the backend and database:

```powershell
docker compose down
```

This keeps the database data. Adding `--volumes` deletes that data.

## Project documentation

Additional project documentation is available here:

- [Developer Guide](docs/DEVELOPER_GUIDE.md) - setup, testing, and troubleshooting
- [Changelog](CHANGELOG.md) - summary of project changes
- [AI Usage & Verification Log](AI_USAGE_LOG.md) - AI-assisted work and how we checked it

## Working as a team

We use GitHub Issues to track tasks and bugs. Changes are made on branches
and submitted through pull requests for teammates to review before merging
into `main`.

Commit messages use prefixes such as `feat:`, `fix:`, `test:`, and `docs:`.
Pull requests should reference the issues they address.

## AI use

We used ChatGPT to help plan the prototype, draft code and tests, update
documentation, and troubleshoot setup problems. We reviewed the changes
and checked them by running the application, testing API responses and
database operations, and using automated code checks.

Our AI prompts and verification records are kept in
[AI_USAGE_LOG.md](AI_USAGE_LOG.md).

## What is not finished yet

Prototype 2 is still an alpha build. Live retailer results are not
matched automatically to guarantee they are the exact same product.
We do not have price history, automatic target-price alerts, or a real
checkout system. Google sign-in is not implemented yet.

Live searches depend on SerpAPI, while our original product comparison
API still uses sample data.
