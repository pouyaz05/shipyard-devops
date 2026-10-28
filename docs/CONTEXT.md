
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
## Services registry (update)
| cart-service | cart_db | /api/cart-service/ | cart-service-secret |

## Conventions added in BE-4 / FE-4
- Service-to-service calls use plain HTTP with a URL from env (e.g. PRODUCT_SERVICE_URL=http://product-service:8000), a 3s timeout, and return 502 with {"detail": "..."} when the other service fails.
- JWT: issued only by user-service. cart-service may VERIFY tokens (same JWT_SECRET and algorithm from env, user id in the `sub` claim). No service issues tokens except user-service.
- product-service is the source of truth for price and stock. Other services store only a snapshot (product_id, name, unit_price_cents) and never write to its database.
- Money is always integer cents.

| order-service | orders_db | /api/order-service/ | order-service-secret |

## Conventions added in BE-5 / FE-5
- Internal-only endpoints live under /internal/... (NOT /api/...), protected by header
  X-Internal-Key (value from env INTERNAL_API_KEY). Ingress never routes /internal.
- order-service forwards the user's Bearer token when calling cart-service.
- Stock changes are atomic: UPDATE ... SET stock = stock - n WHERE id = X AND stock >= n.
- If a multi-step operation fails midway, compensate (undo the earlier steps) and return a clear error.
- Orders store an immutable snapshot of name, unit price and quantity. Later price changes never alter old orders.
- Payment is simulated (no real gateway).


## Planned (not implemented yet)

## Roles and auth (BE-6)
- JWT issued only by user-service. Claims: `sub` (user id), `role` ("user" or "admin"), `exp`.
- Other services verify the JWT locally (same JWT_SECRET and algorithm from env) and read `role`.
- Admin-only endpoints return 403 for non-admins and 401 without a token.
- The temporary X-Admin-Key header is REMOVED (replaced by role=admin).
- Admin users are created only by a manual script (scripts/make_admin.py), never via the public API.

## Reviews (BE-7)
- Reviews live in product-service. One review per user per product, rating 1 to 5.
