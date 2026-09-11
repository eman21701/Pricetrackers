# Developer Guide

## Getting started

Follow the [README](../README.md) to set up your environment, start Docker,
create the database tables, and add the sample data.

Prototype 1 uses made-up products and prices. It does not collect live
retailer data. All prices are stored in cents and exclude tax and shipping.

## Where things go

| File or folder             | Purpose                                    |
| -------------------------- | ------------------------------------------ |
| `src/server.js`            | Starts the server and handles API requests |
| `src/Database.js`          | Manages database connections and queries   |
| `src/ProductRepository.js` | Gets products and offers from the database |
| `src/ComparisonService.js` | Compares prices and handles ties           |
| `migrations/`              | Creates or changes database tables         |
| `seeds/`                   | Adds the sample products and offers        |
| `tests/unit/`              | Tests the comparison logic                 |
| `.github/workflows/ci.yml` | Runs automated checks on GitHub            |
| `tsconfig.json`            | Configures JavaScript type checking        |
| `knexfile.cjs`             | Configures migrations and seeds            |

Release notes are in `CHANGELOG.md`. AI assistance and verification
records belong in `AI_USAGE_LOG.md`.

## How the code works

Each class has a separate job:

- **PriceTrackersApplication** sets up Express, handles requests, and
  starts the server.
- **Database** owns the connection pool and runs queries.
- **ProductRepository** keeps the product and offer SQL in one place.
- **ComparisonService** calculates the lowest price, tied retailers,
  and the difference between the highest and lowest prices.

For an offer request, the server checks the product ID, asks the repository
for data, passes the offers to the comparison service, and returns JSON.

We use composition, meaning the application combines these smaller
objects to do its work. The database is passed into constructors, and
private fields keep each class's internal state separate.

Keep SQL in the repository and price calculations in the comparison
service. This makes changes easier to follow and lets us test comparisons
without starting a database. Update JSDoc comments when changing inputs
or return values.

## Database

There are three application tables:

- `products`: product names, brands, and models.
- `retailers`: retailer names.
- `offers`: prices and other offer details, linked to a product and retailer.

Queries pass user values separately from SQL text. Do not insert user
input directly into SQL strings.

For future schema changes, add a new migration with both `up` and `down`
functions. Avoid editing migrations already shared with the team.

Rollback deletes application data, so test it only on a disposable local
database. Reapply the migration and seeds afterward.

Running our seed script again should leave the sample data at
3 products, 2 retailers, and 6 offers on a fresh test database.

## Making and checking changes

1. Read or create a GitHub issue for the task.
2. Work on a named branch and coordinate shared changes with the team.
3. Make the change and update any affected comments or documentation.
4. Run the relevant checks.
5. Commit, push, and open a PR linked to the issue.
6. Have a teammate review the work before merging.

For the initial prototype, our implementation branch is
`chore/local-development`, with review in PR #7.

Use the Docker commands in the README to run these scripts:

| Script                 | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `npm test`             | Runs the comparison unit tests               |
| `npm run typecheck`    | Checks types in application JavaScript       |
| `npm run lint`         | Checks JavaScript coding rules               |
| `npm run format`       | Applies formatting                           |
| `npm run format:check` | Checks formatting without editing files      |
| `npm run changelog`    | Generates release notes from commit messages |

The changelog command needs Git. Use the full `node:24-bookworm` image
shown in the README for that command.

After changing backend code, rebuild with:

`docker compose up --build -d`

GitHub Actions also runs the quality checks and secret scan. Record test
results and bugs in GitHub Issues, including the commit tested, expected
result, actual result, and supporting logs or screenshots.

Our nine unit tests cover comparison logic. API responses and database
behavior also need separate verification.

## Local settings

Create `.env` from `.env.example` and use your own local password.
Do not commit `.env`.

The backend connects to the Docker service named `database`. Open the API
on your computer at `http://localhost:3000`.

Changing the password in `.env` does not change the password in an
existing PostgreSQL database.
