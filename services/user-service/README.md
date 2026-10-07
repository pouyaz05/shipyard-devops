# user-service

FastAPI service for Shipyard: registration, login (JWT) and the current user.

## Endpoints
| Method | Path | Notes |
|--------|------|-------|
| GET | /health | liveness, no prefix |
| GET | /ready | 200 if `SELECT 1` works, 503 if the DB is down |
| POST | /api/user-service/auth/register | 201, 409 if email exists |
| POST | /api/user-service/auth/login | 200 token, 401 `Invalid credentials` |
| GET | /api/user-service/users/me | needs `Authorization: Bearer <token>` |

## Environment variables
| Var | Default | Required | Notes |
|-----|---------|----------|-------|
| DATABASE_URL | none | yes | `postgresql+psycopg://USER:PASS@HOST:5432/users_db` |
| JWT_SECRET | none | yes | at least 32 characters; the app exits at startup if missing |
| JWT_EXPIRE_MINUTES | 60 | no | token lifetime |
| JWT_ALGORITHM | HS256 | no | HS256, HS384 or HS512 |
| APP_ENV | dev | no | |
| LOG_LEVEL | INFO | no | |

Generate a secret: `openssl rand -hex 32`. Never commit real values.

## Tests
Tests use in-memory SQLite, no Postgres needed. Run them in Python 3.12 (same as the image):
```bash
docker run --rm -e PYTHONDONTWRITEBYTECODE=1 -v "$PWD":/app -w /app python:3.12-slim sh -c \
  "pip install -q --no-cache-dir --default-timeout=120 -r requirements-dev.txt && python -m pytest -q -p no:cacheprovider"
```
Add `-i https://pypi.tuna.tsinghua.edu.cn/simple` after `pip install` if pypi.org is slow.

## Migrations
Migrations never run on app startup. Run them as a separate command:
```bash
DATABASE_URL=... alembic upgrade head
# inside the image:
docker run --rm -e DATABASE_URL=... user-service:dev alembic upgrade head
```

## Docker
```bash
docker build --build-arg PIP_INDEX_URL=... --build-arg PIP_DEFAULT_TIMEOUT=120 -t user-service:dev .
docker run --rm -p 8000:8000 -e DATABASE_URL=... -e JWT_SECRET=... user-service:dev
```

## Local run with Postgres (manual testing only)
Save as `docker-compose.local.yml` (do not commit):
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: users
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD}
      POSTGRES_DB: users_db
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U users -d users_db"]
      interval: 3s
      retries: 10
  user-service:
    build:
      context: .
      args:
        PIP_INDEX_URL: ${PIP_INDEX_URL:-}
    environment:
      DATABASE_URL: postgresql+psycopg://users:${POSTGRES_PASSWORD}@db:5432/users_db
      JWT_SECRET: ${JWT_SECRET:?set JWT_SECRET}
    ports: ["8000:8000"]
    depends_on:
      db:
        condition: service_healthy
```
```bash
export POSTGRES_PASSWORD=$(openssl rand -hex 12) JWT_SECRET=$(openssl rand -hex 32)
docker compose -f docker-compose.local.yml up -d db
docker compose -f docker-compose.local.yml run --rm user-service alembic upgrade head
docker compose -f docker-compose.local.yml up -d user-service
```
