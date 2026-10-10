
# Shipyard: Project Context
Online shop for electronic parts (ESP32, sensors, modules). **UI language: English only.**

## Repo layout
services/<name>/ (FastAPI services)   frontend/ (React)   k8s/ (manifests/Helm)

## Backend stack
Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, PostgreSQL, pytest.
Each service: app/ (main.py, routers/, models/, schemas/, core/config.py), tests/, Dockerfile, requirements.txt.
Config only via env vars. Endpoints: GET /health, GET /ready. JSON logs to stdout.

## Frontend stack
React 18, Vite, TypeScript, Tailwind, React Router, vitest. Dockerfile: multi-stage, nginx.

## Rules
- Dockerfile: multi-stage, slim base, non-root user
- Small focused changes, tests for every endpoint/page
- API errors: {"detail": "..."}; prefix all APIs with /api/<service>/
- Never hardcode secrets
## Infra rules (do not change)
- Kubernetes namespace: `sy`. Services reachable inside cluster as http://<service-name> (port 80).
- Container user: UID 10001, non-root. App listens on 8000 (backend) / 8080 (frontend).
- All config via env vars. Secrets (DB password, JWT secret) come from env, never hardcoded or committed.
- DB: one PostgreSQL instance, one database per service (user-service -> `users_db`).
  Env: DATABASE_URL=postgresql+psycopg://USER:PASS@HOST:5432/users_db
- Migrations (Alembic) run as a separate command (`alembic upgrade head`), NOT on app startup.
- Public API prefix: /api/<service>/ (e.g. /api/user-service/auth/login). Errors: {"detail": "..."}.
- pip mirror: Dockerfile keeps ARG PIP_INDEX_URL / PIP_DEFAULT_TIMEOUT.
## Services registry
| Service | DB | Public prefix | Secret (k8s) |
|---|---|---|---|
| user-service | users_db | /api/user-service/ | user-service-secret |
| product-service | products_db | /api/product-service/ | product-service-secret |
| frontend | - | / | - |

## Conventions added in BE-3 / FE-3
- Every new backend service gets its own database (`<name>_db`) on the same PostgreSQL instance.
- Seed/data scripts live in `scripts/` and are run manually, never on app startup.
- Temporary admin protection for write endpoints: header `X-Admin-Key`, value from env `ADMIN_API_KEY` (will be replaced by roles later).
- Prices are stored as integer cents (`price_cents`); the frontend formats them as dollars.
- Frontend calls APIs only via relative paths (`/api/<service>/...`), never full URLs.
- Auth token (from user-service) is validated by user-service only. Other services do not decode JWT yet.