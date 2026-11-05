# Folio · Mini CRM

A standalone, dark-first CRM for independent work. React + TypeScript + Vite + Tailwind, customized shadcn/ui source components with Radix foundations, Lucide and Recharts; FastAPI + SQLAlchemy 2 + Pydantic + Alembic + PostgreSQL. All CRM data, metrics, and activity come from the API/database.

## Start with Docker

Requires Docker Engine and Docker Compose v2.

For an automatic local launch, run this from a normal desktop terminal:

```sh
./start.sh
```

The launcher generates a private `.env` if missing, builds and starts PostgreSQL/API/frontend, waits for readiness, and opens http://localhost:5173 in your browser. Existing configuration is preserved. If Docker requires administrator access, use `./start.sh --sudo`. To stop the services, run `docker compose down` (with `sudo` if needed).

Alternatively, configure and launch manually:

```sh
cp .env.example .env
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
# Paste the generated value into JWT_SECRET in .env.
# Set POSTGRES_PASSWORD to your own local database password.
docker compose up --build
```

Open **http://localhost:5173** and choose **Create an account**. The workspace starts empty. Backend API documentation: **http://localhost:8000/docs**. PostgreSQL data persists in the `postgres_data` volume. Backend startup runs migrations before serving traffic. Stop with `docker compose down`; this preserves the database volume.

Compose derives the backend database URL from POSTGRES_USER/PASSWORD/DB; the root DATABASE_URL is for native development. Use URL-safe database passwords, or percent-encode special URL characters in a manually supplied database URL. Never commit `.env`.

## Native development

Requires Python **3.12+**, Node **22+**, npm and PostgreSQL **16+**.

```sh
cp .env.example .env
# Set JWT_SECRET and PostgreSQL credentials in .env.
docker compose up -d db
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/alembic -c backend/alembic.ini upgrade head
.venv/bin/uvicorn app.main:app --app-dir backend --reload --port 8000
```

In another terminal:

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to port 8000, preserving same-origin refresh cookies. Run Python commands from the repository root so `.env` is loaded. Run frontend commands inside `frontend/`. The API refuses to start without a JWT secret at least 32 characters long.

`VITE_API_URL` defaults to `/api`; a different build-time value can be set in `frontend/.env`. For another frontend origin, change FRONTEND_ORIGIN as well. Keep the API and frontend on the same site so SameSite=Strict refresh cookies work.

## Optional demonstration data

Seed is explicit and separate from app startup. It creates a **new** account and never modifies an existing account:

```sh
docker compose exec backend python -m app.seed --email demo@example.com
# Enter a password at the prompt, then sign in with that email/password.
```

Native equivalent:

```sh
PYTHONPATH=backend .venv/bin/python -m app.seed --email demo@example.com
```

The seed creates 8 clients, 6 leads, 24 deals across recent months, and 8 tasks. All demo content is labeled in notes. Production registration creates no sample records.

## Features

- Registration, sign-in/out, salted scrypt hashing, short-lived access JWTs, rotating HTTP-only refresh cookies, immediate session revocation.
- Private clients with tags, contact details, notes, last interaction, and related work.
- Leads with source/status/value and atomic, tracked conversion to a client.
- Deals with table and Kanban views, drag/drop plus accessible status selects, and persisted state.
- Tasks with priority/status filters, due-date sorting, overdue indicators and quick completion.
- Database-backed overview and analytics, date filtering, revenue/client trends, conversion metrics and CSV report export.
- Global search, task reminders, sidebar collapse, responsive mobile drawer, profile/password/theme settings and permanent account deletion.
- Pagination, backend filtering/sorting, validation, error/loading/empty/success states, confirmed destructive actions.

## Screenshots

### Overview

![Folio CRM overview dashboard](screenshots/overview.jpg)

### Clients

![Folio CRM client workspace](screenshots/clients.jpg)

### Deals

![Folio CRM deals workspace](screenshots/deals.jpg)

### Tasks

![Folio CRM task workspace](screenshots/tasks.jpg)

### Mobile overview

![Folio CRM overview on mobile](screenshots/overview-mobile.jpg)

## Migrations

```sh
.venv/bin/alembic -c backend/alembic.ini upgrade head
.venv/bin/alembic -c backend/alembic.ini current
# After changing a model:
.venv/bin/alembic -c backend/alembic.ini revision --autogenerate -m "describe change"
# Review the generated migration before applying it.
```

In Docker, use `docker compose exec backend alembic ...` without `-c`. The initial migration is versioned and explicit. Downgrades remove data; use only on disposable databases or after taking a backup.

## Validation

```sh
# Portable API, relational service, security and validation tests:
.venv/bin/pytest -q

# PostgreSQL integration tests, using a disposable test database:
TEST_DATABASE_URL=postgresql+asyncpg://minicrm:password@localhost:5432/minicrm_test \
  .venv/bin/pytest -q

cd frontend
npm test
npm run build
```

Without TEST_DATABASE_URL, HTTP tests exercise the real API and services against a disposable SQLite database in the test fixture; the application itself always uses PostgreSQL. With TEST_DATABASE_URL, integration tests create a uniquely named PostgreSQL schema, apply the actual Alembic migration, and remove only that schema. The test role needs CREATE SCHEMA permission. They cover authentication rotation/revocation, complete CRM lifecycle, real analytics, duplicate conversion, account deletion, association cleanup, pagination, and cross-user read/write/reference isolation. No production tables are dropped.

This workspace's execution environment blocks package downloads and listening/database sockets. Portable HTTP/service/security tests, PostgreSQL migration SQL, and available local compilation checks have been verified; live PostgreSQL integration, the standard Vite production build, and browser-to-API verification require a normal local environment. See `docs/VERIFICATION.md` for exact results and remaining checks.

## Deployment

Build the supplied Docker images and put the frontend service behind an HTTPS reverse proxy. Set FRONTEND_ORIGIN to its exact public HTTPS origin, COOKIE_SECURE=true, a strong random JWT_SECRET, and strong PostgreSQL credentials. Keep database and direct backend ports private. Nginx serves the frontend and proxies `/api`, and rate-limits login/registration. Use one migration job before scaling API replicas; the Compose startup command is intended for a single local API instance. Configure backups, monitoring and TLS at your deployment platform.

See [architecture and API contract](docs/ARCHITECTURE.md) for schema, transaction boundaries, security decisions, metric definitions, and the deliberately bounded MVP scope.
