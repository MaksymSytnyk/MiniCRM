# Verification results

Verified on 2026-11-05 with Docker Compose and PostgreSQL 17:

- `./start.sh` built the backend and frontend images, applied the initial Alembic migration, started all three services, and passed the proxied `/api/health` check. The site and API returned HTTP 200 at `http://localhost:5173` and `http://localhost:5173/api/health`.
- **19 backend tests passed against the live PostgreSQL service.** Each test session created a unique temporary schema, ran the actual Alembic migration, and removed that schema afterward. Tests cover authentication, token rotation and revocation, record CRUD, conversion, analytics, filters, transactions, validation, and cross-account isolation.
- A live HTTP smoke flow through the nginx proxy passed registration, profile retrieval, client/lead/deal/task creation, deal status change, client search, analytics, lead conversion, activity, refresh, and test-account deletion. These operations used PostgreSQL persistence.
- **3 frontend API-client tests passed**, covering access-token refresh and retry, concurrent refresh coordination, and revoked-session handling.
- `npm run build` completed with TypeScript checking and Vite's production bundle. Docker built the same frontend successfully. Vite reported a non-failing bundle-size warning for the main JavaScript chunk.
- `xdg-open http://localhost:5173` exited successfully and Firefox is running on the desktop. The computer-use bridge exposed no browser surface, so a visual browser inspection could not be recorded from this session.

The startup script leaves the services running. Stop them with `docker compose down` from the project directory. Demo seed data is optional and is never loaded at startup.
