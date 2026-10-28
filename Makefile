SHELL := /bin/bash
ifneq ($(wildcard .env),)
include .env
endif
PIP_INDEX_URL ?= https://pypi.org/simple
GATEWAY_PORT ?= 8080
SERVICES := user-service product-service cart-service order-service

.PHONY: help env up down logs ps seed test e2e helm-lint clean

help: ## Show this help
	@grep -E '^[a-z0-9-]+:.*## ' Makefile | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

.env:
	@echo "Creating .env with random development secrets"
	@printf 'POSTGRES_PASSWORD=%s\nJWT_SECRET=%s\nADMIN_API_KEY=%s\nINTERNAL_API_KEY=%s\nGATEWAY_PORT=8080\n' \
	  "$$(openssl rand -hex 12)" "$$(openssl rand -hex 32)" "$$(openssl rand -hex 16)" "$$(openssl rand -hex 16)" > .env

env: .env ## Create .env with random secrets (if missing)

up: .env ## Build and start the whole stack (migrations run automatically)
	docker compose up -d --build
	@echo "Shop: http://localhost:$(GATEWAY_PORT)   (run 'make seed' once to load demo products)"

down: ## Stop the stack (data is kept)
	docker compose down

clean: ## Stop the stack and delete all data
	docker compose down -v

logs: ## Follow logs
	docker compose logs -f --tail=50

ps: ## Show containers
	docker compose ps

seed: ## Load demo products
	docker compose exec -T product-service python -m scripts.seed

test: ## Run backend tests in a python:3.12 container
	@for s in $(SERVICES); do \
	  echo "==> $$s"; \
	  docker run --rm -e PYTHONDONTWRITEBYTECODE=1 -v "$(CURDIR)/services/$$s":/app -w /app python:3.12-slim \
	    sh -c "pip install -q -r requirements-dev.txt -i $(PIP_INDEX_URL) && python -m pytest -q -p no:cacheprovider" || exit 1; \
	done

e2e: ## Run the scripted purchase flow against the running stack
	BASE_URL=http://localhost:$(GATEWAY_PORT) ./scripts/e2e.sh

helm-lint: ## Lint the Helm charts
	docker run --rm -v "$(CURDIR)/k8s":/k8s --entrypoint sh alpine/helm:4.2.4 -c \
	  'for s in user-service product-service cart-service order-service frontend; do helm lint /k8s/charts/service -f /k8s/values/$$s.yaml || exit 1; done; helm lint /k8s/infra/postgres'
