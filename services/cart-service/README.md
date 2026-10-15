# cart-service

Shopping cart for Shipyard. One cart per user; every endpoint needs `Authorization: Bearer <token>`
(tokens are issued by user-service, this service only verifies them).

## Endpoints
| Method | Path | Notes |
|--------|------|-------|
| GET | /health, /ready | no prefix; `/ready` returns 503 if the DB is down |
| GET | /api/cart-service/cart | items and `total_cents` (empty cart if none) |
| POST | /api/cart-service/cart/items | `{product_id, quantity}`; 201 new line, 200 if the product was already in the cart (quantity is summed) |
| PATCH | /api/cart-service/cart/items/{product_id} | `{quantity}`; 404 if not in cart |
| DELETE | /api/cart-service/cart/items/{product_id} | 204, 404 if not in cart |
| DELETE | /api/cart-service/cart | 204, empties the cart |

Errors: 401 bad or missing token, 404 unknown product, 409 `Insufficient stock`, 502 product-service
unreachable. Body is always `{"detail": "..."}`. Quantity is 1 to 1000. Money is integer cents.

On add, product-service is asked for name, price and stock, and a snapshot is stored.
Stock is checked, not reserved.

## Environment variables
| Var | Default | Required | Notes |
|-----|---------|----------|-------|
| DATABASE_URL | none | yes | `postgresql+psycopg://USER:PASS@HOST:5432/cart_db` |
| JWT_SECRET | none | yes | same value as user-service, at least 32 characters |
| JWT_ALGORITHM | HS256 | no | must match user-service |
| PRODUCT_SERVICE_URL | none | yes | for example `http://product-service:8000`, 3 second timeout |
| APP_ENV | dev | no | |
| LOG_LEVEL | INFO | no | |

Never commit real values.

## Tests
No Postgres and no network: SQLite in memory, product-service is mocked. Run with Python 3.12:
```bash
docker run --rm -e PYTHONDONTWRITEBYTECODE=1 -v "$PWD":/app -w /app python:3.12-slim sh -c \
  "pip install -q --no-cache-dir --default-timeout=120 -r requirements-dev.txt && python -m pytest -q -p no:cacheprovider"
```
Add `-i https://pypi.tuna.tsinghua.edu.cn/simple` after `pip install` if pypi.org is slow.

## Migrations (separate command, never on app startup)
```bash
DATABASE_URL=... alembic upgrade head
docker run --rm -e DATABASE_URL=... cart-service:dev alembic upgrade head
```

## Docker
```bash
docker build --build-arg PIP_INDEX_URL=... --build-arg PIP_DEFAULT_TIMEOUT=120 -t cart-service:dev .
docker run --rm -p 8000:8000 -e DATABASE_URL=... -e JWT_SECRET=... \
  -e PRODUCT_SERVICE_URL=http://product-service:8000 cart-service:dev
```
