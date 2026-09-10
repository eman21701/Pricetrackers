# PriceTrackers

PriceTrackers is our Senior Design II project. Our goal is to help users
compare prices for the same product at Amazon and Walmart.

For Prototype 1, we are using made-up products and prices to test the
system. We are not collecting live prices or scraping either website yet.

## What works so far

- Searching for products by name, brand, or model
- Getting Amazon and Walmart offers for a product
- Finding the lower price or showing when both prices are equal
- Checking whether the server and database are working
- Creating and rolling back database tables
- Adding sample data without creating duplicates

The prices we compare do not include tax or shipping.

## Tools we are using

- JavaScript and Node.js 24 for the backend
- Express for API endpoints
- PostgreSQL 17 for the database
- Knex for database migrations and sample data
- Docker Compose to run the backend and database together
- GitHub Actions to run tests and code checks

## Setting up the project

You will need Git, Docker Desktop, and access to this repository.
On Windows, Docker Desktop needs WSL 2 configured.

Open Docker Desktop before starting. You do not need to install Node.js
or PostgreSQL separately when using these Docker commands.

Run these commands in PowerShell:

```powershell
git clone https://github.com/eman21701/Pricetrackers.git
cd Pricetrackers
git switch chore/local-development
Copy-Item .env.example .env
```

We are currently using `chore/local-development` while the work is being
reviewed. These instructions will be updated after it's merged.

Open `.env` and fill in these settings:

| Setting             | What to enter                       |
| ------------------- | ----------------------------------- |
| `POSTGRES_DB`       | `pricetrackers`                     |
| `POSTGRES_USER`     | `pricetrackers`                     |
| `POSTGRES_PASSWORD` | Your own local development password |

Do not upload `.env` to GitHub. The `.env.example` file is the template
that teammates can use.

The password is used when the database is first created. Changing it
in `.env` later does not change the password in an existing database.

Start the backend and database:

```powershell
docker compose up --build -d
```

Create the database tables:

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

## Trying the API

Open these addresses in your browser:

| Address                                              | What it does                                      |
| ---------------------------------------------------- | ------------------------------------------------- |
| http://localhost:3000/health                         | Checks whether the backend responds               |
| http://localhost:3000/ready                          | Checks whether the backend can reach the database |
| http://localhost:3000/api/products                   | Lists the products                                |
| http://localhost:3000/api/products?search=headphones | Searches for headphones                           |

To see a product's offers, use:

```text
http://localhost:3000/api/products/PRODUCT_ID/offers
```

Replace `PRODUCT_ID` with the ID shown in the search results.

Prices in the response are in cents for now. For example, `4999` means $49.99.
The `is_synthetic` field identifies our made-up offers.

## Sample data

| Product                  | Walmart | Amazon | Expected result    |
| ------------------------ | ------: | -----: | ------------------ |
| Demo Wireless Headphones |  $49.99 | $54.99 | Walmart is cheaper |
| Demo Coffee Maker        |  $34.99 | $29.99 | Amazon is cheaper  |
| Demo USB-C Charger       |  $19.99 | $19.99 | Same price         |

A new database with the sample data should have 3 products, 2 retailers,
and 6 offers. Running the seed command again should not add duplicates.

## How the code is organized

| File or folder             | What it is for                             |
| -------------------------- | ------------------------------------------ |
| `src/server.js`            | Starts Express and handles API requests    |
| `src/Database.js`          | Manages database connections and queries   |
| `src/ProductRepository.js` | Gets products and offers from the database |
| `src/ComparisonService.js` | Finds the lowest price and handles ties    |
| `migrations/`              | Creates and removes the database tables    |
| `seeds/`                   | Adds the sample products and prices        |
| `tests/unit/`              | Tests the comparison code                  |
| `.github/workflows/ci.yml` | Runs checks on GitHub                      |

The database currently has three main tables: `products`, `retailers`, and `offers`.
Each offer connects a product to a retailer and stores its price.

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

Check formatting:

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/app" -w /app node:24-bookworm-slim npm run format:check
```

To fix the formatting, use the same Docker command with `npm run format`.

We currently have nine unit tests for the comparison code. These do not
test the entire application or every database operation.

GitHub Actions also runs the tests, linting, formatting checks, and a
secret scan. The results are available in the repository's Actions tab.

## Testing database rollback

Rollback removes the application tables and everything stored in them.
Only do this with a local test database whose data you can replace.

```powershell
docker compose exec backend npx knex --knexfile knexfile.cjs migrate:rollback
```

To restore the tables and sample data, run the migration and seed commands
from the setup section again.

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

To stop the project:

```powershell
docker compose down
```

This keeps the database data. Adding `--volumes` deletes that data.

## Working as a team

We use GitHub Issues to track tasks and bugs. Changes are made on branches
and submitted through pull requests for a teammate to review.

Commit messages use prefixes such as `feat:`, `fix:`, `test:`, and `docs:`.
Pull requests should reference the issues they address.

## AI use

We used ChatGPT to help plan the prototype, generate initial code and tests,
draft documentation, and troubleshoot setup problems. We checked the
generated work by running it locally on our own individual machines, checking API responses, testing database migrations and rollback, and running automated tests and code checks.

Our AI prompts, changes, and verification results are being recorded in `AI_USAGE_LOG.md`.

## What is not finished yet

Prototype 1 does not have live retailer data, a finished frontend,
user accounts, wishlists, or price history.

Products are matched manually in our sample data. Searches return up to
50 products. We currently support USD prices only.

Full static type checking and the detailed developer guide are still
being completed.
