# order-service

Checkout and orders for Shipyard. Skeleton only for now: `/health`, `/ready`, config, models and the first migration.
Order endpoints come in the next ticket.

## Environment variables
| Var | Default | Required | Notes |
|-----|---------|----------|-------|
| DATABASE_URL | none | yes | `postgresql+psycopg://USER:PASS@HOST:5432/orders_db` |
| JWT_SECRET | none | yes | same value as user-service, at least 32 characters |
| JWT_ALGORITHM | HS256 | no | must match user-service |
| CART_SERVICE_URL | none | yes | for example `http://cart-service:8000` |
| PRODUCT_SERVICE_URL | none | yes | for example `http://product-service:8000` |
| INTERNAL_API_KEY | none | yes | same value as product-service, at least 16 characters |
| APP_ENV | dev | no | |
| LOG_LEVEL | INFO | no | |

The app exits at startup if a required variable is missing or invalid. Never commit real values.

## Tests
No Postgres and no network: SQLite in memory. Run with Python 3.12:
```bash
docker run --rm -e PYTHONDONTWRITEBYTECODE=1 -v "$PWD":/app -w /app python:3.12-slim sh -c \
  "pip install -q --no-cache-dir --default-timeout=120 -r requirements-dev.txt && python -m pytest -q -p no:cacheprovider"
```
Add `-i https://pypi.tuna.tsinghua.edu.cn/simple` after `pip install` if pypi.org is slow.

## Migrations (separate command, never on app startup)
```bash
DATABASE_URL=... alembic upgrade head
docker run --rm -e DATABASE_URL=... order-service:dev alembic upgrade head
```

## Docker
```bash
docker build --build-arg PIP_INDEX_URL=... --build-arg PIP_DEFAULT_TIMEOUT=120 -t order-service:dev .
docker run --rm -p 8000:8000 -e DATABASE_URL=... -e JWT_SECRET=... -e CART_SERVICE_URL=... \
  -e PRODUCT_SERVICE_URL=... -e INTERNAL_API_KEY=... order-service:dev
```
