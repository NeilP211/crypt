# Crypt — developer task runner.
# `make up` boots the whole stack; `make ingest` populates real data.

COMPOSE := docker compose -f deploy/docker-compose.yml
REGION  ?= berlin
LIMIT   ?= 800

.PHONY: help up down logs ps ingest bench test fmt lint clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Build and start the full local stack
	mkdir -p data
	$(COMPOSE) up -d --build

down: ## Stop the stack
	$(COMPOSE) down

logs: ## Tail logs from every service
	$(COMPOSE) logs -f

ps: ## Show service status
	$(COMPOSE) ps

ingest: ## Scrape OSM, embed with CLIP, build the index (REGION=, LIMIT=)
	$(COMPOSE) exec -T embed python -m crypt_ingest.cli \
		--region $(REGION) --limit $(LIMIT) \
		--dsn postgres://crypt:crypt@postgres:5432/crypt \
		--embeddings-out /app/data/embeddings.bin
	$(COMPOSE) exec -T server build-index /app/data/embeddings.bin /app/data/crypt.index
	$(COMPOSE) restart server

bench: ## Run the HNSW recall-vs-latency benchmark report
	cargo run --release --bin hnsw-report -- 100000 128

test: ## Run the Rust and Python test suites
	cargo test --workspace
	cd ingestion && python -m pytest -q

fmt: ## Format Rust code
	cargo fmt --all

lint: ## Lint Rust (clippy) and the frontend
	cargo clippy --workspace --all-targets -- -D warnings
	cd web && npm run lint

clean: ## Stop the stack and remove all volumes
	$(COMPOSE) down -v
