# order-service

Checkout and orders for Shipyard. Every `/api/order-service/...` endpoint needs `Authorization: Bearer <token>`
(tokens are issued by user-service, this service only verifies them).

## Endpoints
| Method | Path | Notes |
|--------|------|-------|
| GET | /health, /ready | no prefix; `/ready` returns 503 if the DB is down |
| POST | /api/order-service/orders | body `{shipping_name, shipping_address, shipping_city}`; 201 with the order |
| GET | /api/order-service/orders | own orders, newest first; `limit` (1 to 100, default 50) and `offset` |
| GET | /api/order-service/orders/{id} | 404 if unknown or not yours |
| POST | /api/order-service/orders/{id}/pay | simulated payment, `PENDING_PAYMENT` to `PAID`; 409 in any other state |

Errors are always `{"detail": "..."}`. Money is integer cents. Statuses: `PENDING_PAYMENT`, `PAID`, `CANCELLED`
(there is no cancel endpoint yet).

## How POST /orders works
1. Read the cart from cart-service with the user's own token. Empty cart: 400.
2. Ask product-service for the current price and stock of every item. A price that differs from the cart
   snapshot, a product that no longer exists or not enough stock: 409 with a clear message, nothing is changed.
3. Decrement stock through `POST /internal/products/{id}/decrement`. If one item fails, the earlier ones are given
   back with `/increment` (compensation) and the answer is 409 (502 if product-service is unreachable).
4. Save the order and its items (an immutable snapshot of name, unit price and quantity) in one transaction.
   If this fails, all stock is given back and the answer is 500.
5. After the commit, clear the cart. If that fails only a warning is logged and the order stays valid.

No HTTP call is ever made while a database transaction is open. Every call to another service has a 3 second
timeout. A network error or an unexpected answer gives 502.

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
No Postgres and no network: SQLite in memory, cart-service and product-service are replaced by fakes. Python 3.12:
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
