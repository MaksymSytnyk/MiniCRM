# Architecture and implementation plan

Folio is a standalone CRM with independent React/TypeScript/Vite and FastAPI applications. REST is the only application interface. PostgreSQL owns persisted state; the browser holds only transient UI state and the sidebar preference. No production seed or mock fallback exists.

## Data model

- `users`: unique normalized email, full name, scrypt password hash, company, theme.
- `auth_sessions`: user, SHA-256 digest of the latest refresh JWT, absolute expiration.
- `clients`: owner, contact details, notes, last interaction; many-to-many tags.
- `tags`: owner and name, unique within each account.
- `leads`: contact, source, status, estimated value, converted client and timestamp.
- `deals`: optional client, decimal value, status, expected close, won timestamp.
- `tasks`: optional client and/or deal, due date, priority and status.
- `activity_logs`: owner, action, entity type/ID and historical description.
- Every entity has UUID identifiers and created/updated timestamps. Owned entities index the owner; deals index owner/status, tasks index owner/due date. Foreign keys cascade account deletion. Removing a client/deal preserves related work using SET NULL. Tags have a join table with cascading foreign keys. Database check constraints enforce monetary and status invariants.

## Backend boundaries

`api/routes` maps HTTP requests and Pydantic validation to services. `services` implements conversion, persistence, serialization and analytics. `repositories/records.py` centralizes ownership lookups. `dependencies` authenticates requests. `core` owns configuration, hashing, JWTs, database lifetime, and the async ORM service bridge. SQLAlchemy's `AsyncSession.run_sync` runs conventional ORM services using asyncpg without blocking the event loop on database I/O. One request uses one transaction; exceptions roll it back.

Every record query includes the signed-in user's ID. Association writes independently verify ownership, even when an ID is valid. Another user's records return 404. User IDs cannot be submitted in request schemas. The frontend never decides authorization.

Access JWTs live in memory and expire after 15 minutes. Refresh JWTs use an HTTP-only SameSite=Strict cookie and rotate under a database row lock. Their digests and session lifetimes are persisted. All access requests check the session, so logout, password changes and account deletion immediately revoke access. Passwords use scrypt (N=131072, r=8, p=1, random 16-byte salt). Password changes revoke every session. Nginx limits login and registration request rates in the Compose deployment.

Lead conversion locks the lead and creates the client in the same transaction, preserving conversion history and preventing duplicate conversion. Marking a deal won sets its revenue recognition timestamp; reopening removes it. Activity is recorded with the change and commits atomically.

## REST contract

Base URL: `/api`. Swagger: backend `/docs`; OpenAPI: `/openapi.json`.

| Method           | Endpoint                               | Purpose                                  |
| ---------------- | -------------------------------------- | ---------------------------------------- |
| POST             | /auth/register, /auth/login            | Issue access JWT and refresh cookie      |
| POST             | /auth/refresh, /auth/logout            | Rotate or revoke a session               |
| GET, PUT, DELETE | /auth/me                               | Profile, preferences, account deletion   |
| POST             | /auth/password                         | Change password and revoke sessions      |
| GET, POST        | /clients, /leads, /deals, /tasks       | List or create owned records             |
| GET, PUT, DELETE | /{resource}/{id}                       | Read, fully update, or delete            |
| POST             | /leads/{id}/convert                    | Atomic conversion to client              |
| PATCH            | /deals/{id}/status, /tasks/{id}/status | Persist quick changes                    |
| GET              | /tags                                  | Current user's tags                      |
| GET              | /activity                              | Paginated activity                       |
| GET              | /analytics                             | Aggregations filtered by start/end dates |
| GET              | /health                                | Database readiness                       |

Collections accept `q`, `page` (1-based), `page_size` (1–100), `sort` (allowlisted column), `order` (`asc`/`desc`), and applicable `status`, `priority`, `client_id`, `deal_id`, `tag`, `overdue`, `exclude_completed` filters. Responses include `items`, `total`, `page`, `page_size`. Search treats SQL wildcard characters literally. No arbitrary SQL expression can be supplied for sorting.

## Pages and components

The persistent sidebar and top bar provide active navigation, collapse/mobile drawer, profile menu, global search and task reminders. Pages: Overview, Clients, Client profile, Leads, Deals (table and paginated Kanban), Tasks, Analytics, Settings. Reusable shadcn/ui source components with Radix foundations (Button, Input, Dialog), confirmation, record form, state and chart components keep interactions consistent. Lightweight History API routing and a local accessible toast component avoid unrelated UI dependencies. Tailwind and CSS variables define shared themes and utilities; Lucide supplies icons; Recharts renders backend aggregates.

Record forms perform native validation plus authoritative server validation. Updates invalidate active data queries. Kanban changes persist before a refetch and offer a select alternative to drag and drop. Tables, board columns, activity, association searches and related profile lists use bounded API requests. Destructive operations require confirmation. Full data remains on the server when navigating.

## Analytics definitions

Date ranges are inclusive, using UTC timestamps. Revenue groups currently-won deals by `closed_at`; clients group by creation month. Deal performance uses deals created in range; win rate is won/(won+lost). Lead conversion uses leads created in range and their recorded conversion timestamps. All-time totals/pipeline/pending tasks are explicitly labeled. Empty datasets produce zero metrics and zero-filled month series. All monetary values are USD. Date ranges are limited to ten years.

## Scope

This MVP isolates workspaces per user. It does not add shared organizations, invitations, payments, email sending, password reset, file attachments, or multicurrency accounting. Deploy behind HTTPS, enable secure cookies, keep frontend/API on one origin, and supply strong environment secrets. Use a separate database/schema for tests and back up PostgreSQL before production migrations. Scale-out deployments should put authentication rate limiting at a shared trusted edge.
