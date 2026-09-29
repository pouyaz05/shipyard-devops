# user-service

FastAPI service skeleton for Shipyard. No database or auth yet.

## Config (env vars)
| Var | Default |
|-----|---------|
| APP_ENV | dev |
| LOG_LEVEL | INFO |

## Run locally
```bash
cd services/user-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

## Test
```bash
pytest -v
```

## Docker
```bash
docker build -t user-service:dev .
docker run --rm -p 8000:8000 -e APP_ENV=dev -e LOG_LEVEL=INFO user-service:dev
curl localhost:8000/health
curl localhost:8000/ready
```
