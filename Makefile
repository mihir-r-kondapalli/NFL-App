PYTHON ?= python3
VENV := .venv
CLI := $(VENV)/bin/nflsim

.PHONY: help setup setup-r setup-training compile data api web dev check test lint build
help:
	@echo "make setup              Install Python and frontend dependencies"
	@echo "make setup-r            Install the R data-preparation dependencies"
	@echo "make data SEASON=2025    Generate an explicitly selected season"
	@echo "make dev                Start the API and web app together"
	@echo "make check              Run tests, lint, and TypeScript checks"
	@echo "make build              Build the web app for production"
setup:
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/python -m pip install --upgrade pip
	$(VENV)/bin/python -m pip install -c requirements.lock -e '.[dev]'
	npm ci --prefix frontend/nfl-app
setup-r:
	Rscript scripts/install-r.R
setup-training:
	$(VENV)/bin/python -m pip install -c requirements.lock -e '.[training]'
compile:
	$(CLI) compile
data:
	@test -n "$(SEASON)" || (echo "Specify SEASON, e.g. make data SEASON=2025"; exit 1)
	$(CLI) data build --season $(SEASON) $(if $(TEAMS),--teams $(TEAMS),) $(if $(SEED),--seed $(SEED),)
api:
	$(CLI) serve --reload
web:
	npm run dev --prefix frontend/nfl-app
dev:
	$(VENV)/bin/python scripts/dev.py
test:
	$(VENV)/bin/python -m pytest
lint:
	$(VENV)/bin/ruff check src tests scripts
	npm run lint --prefix frontend/nfl-app
check: test lint
	node --test tests/frontend_bracket.cjs
	npm run typecheck --prefix frontend/nfl-app
build:
	npm run build --prefix frontend/nfl-app
