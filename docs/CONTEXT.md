cat > docs/CONTEXT.md << 'EOF'
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
EOF