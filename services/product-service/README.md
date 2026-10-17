# product-service

Product catalog for Shipyard: categories and products. Reads are public, writes need the admin key.

## Endpoints
| Method | Path | Notes |
|--------|------|-------|
| GET | /health, /ready | no prefix; `/ready` returns 503 if the DB is down |
| GET | /api/product-service/products | `page`, `page_size` (max 100), `category` (slug), `q` (name search), `sort` = `created_at`, `-created_at`, `price`, `-price` |
| GET | /api/product-service/products/{slug} | 404 if unknown |
| GET | /api/product-service/products/by-id/{product_id} | 404 if unknown |
| GET | /api/product-service/categories | |
| POST | /api/product-service/products | needs `X-Admin-Key`, 201, 409 on duplicate sku or slug |
| PUT | /api/product-service/products/{slug} | needs `X-Admin-Key`, full replace; slug kept if omitted |
| DELETE | /api/product-service/products/{slug} | needs `X-Admin-Key`, 204 |
| POST | /internal/products/{id}/decrement | internal only, needs `X-Internal-Key`; atomic, 409 `Insufficient stock`, 404 |
| POST | /internal/products/{id}/increment | internal only, needs `X-Internal-Key`; used to compensate a decrement, 404 |

Prices are integer cents (`price_cents`). Errors look like `{"detail": "..."}`.
`/internal/...` is for service-to-service calls only: never route it through the Ingress.
A missing or wrong `X-Internal-Key` returns 403.

## Environment variables
| Var | Default | Required | Notes |
|-----|---------|----------|-------|
| DATABASE_URL | none | yes | `postgresql+psycopg://USER:PASS@HOST:5432/products_db` |
| ADMIN_API_KEY | none | yes | at least 16 characters; protects POST/PUT/DELETE on products; the app exits at startup if missing |
| INTERNAL_API_KEY | none | yes | at least 16 characters; protects `/internal/...` (used by order-service); the app exits at startup if missing |
| APP_ENV | dev | no | |
| LOG_LEVEL | INFO | no | |

Generate a key: `openssl rand -hex 16`. Never commit real values.

## Tests
Tests use in-memory SQLite, no Postgres needed. Run them with Python 3.12:
```bash
docker run --rm -e PYTHONDONTWRITEBYTECODE=1 -v "$PWD":/app -w /app python:3.12-slim sh -c \
  "pip install -q --no-cache-dir --default-timeout=120 -r requirements-dev.txt && python -m pytest -q -p no:cacheprovider"
```
Add `-i https://pypi.tuna.tsinghua.edu.cn/simple` after `pip install` if pypi.org is slow.

## Migrations and seed (manual, never on app startup)
```bash
DATABASE_URL=... alembic upgrade head
DATABASE_URL=... python -m scripts.seed      # 12 demo products, safe to run twice
# inside the image:
docker run --rm -e DATABASE_URL=... product-service:dev alembic upgrade head
docker run --rm -e DATABASE_URL=... product-service:dev python -m scripts.seed
```

## Docker
```bash
docker build --build-arg PIP_INDEX_URL=... --build-arg PIP_DEFAULT_TIMEOUT=120 -t product-service:dev .
docker run --rm -p 8000:8000 -e DATABASE_URL=... -e ADMIN_API_KEY=... -e INTERNAL_API_KEY=... product-service:dev
```
