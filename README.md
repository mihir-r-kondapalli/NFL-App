# 4th & Sim

NFL expected-points modeling, team rankings, interactive football, batch simulations, and optional strategy-agent training. The web app, console, simulations, and training use one Python game engine. Storage is accessed through a repository interface; local SQLite and Supabase are interchangeable adapters.

No historical season datasets or pretrained checkpoints are bundled. Nothing downloads season data, starts games, trains a model, or publishes to a cloud database on installation or startup. You explicitly run those commands. Every season operation requires a season argument.

## Setup

Use macOS or Linux, Node.js 20.9+, Python 3.9+ (3.12 recommended), and a C++17 compiler. R 4.4.2 is the recorded preparation environment; R is only needed to generate datasets.

```sh
make setup          # Python/API/test dependencies and frontend dependencies
make setup-r        # Optional: restore pinned R preparation dependencies
make setup-training # Optional: install PyTorch for training/neural inference
```

Python dependencies are constrained by `requirements.lock`, frontend dependencies by `package-lock.json`, and R preparation dependencies by `pipeline/renv.lock`. All local artifacts live in ignored directories.

The default data provider is local. No database credentials are needed. For custom settings, copy `.env.example` to `.env` and export it before invoking Python commands:

```sh
set -a
source .env
set +a
```

For a custom backend address, copy `frontend/nfl-app/.env.example` to `frontend/nfl-app/.env.local` and set the server-only `API_URL`. Python does not implicitly load `.env`; Next.js loads its `.env.local`.

## Start the system

```sh
make dev  # Starts API and frontend together; Ctrl+C stops both
```

Or start them separately with `make api` and `make web`. The web app is at `http://localhost:3000`; interactive API documentation is at `http://localhost:8000/docs`.

Use **Simulate → Full season** (http://localhost:3000/simulate?mode=season) to run a complete
season, view standings through any week, browse team schedules, and explore the
playoff bracket. Choose a built season, click **Load season schedule** if needed,
then **Simulate season**. Results are temporary and are not automatically saved.

Both services start with an empty data directory. The app displays an empty state until you generate or import a season. Season selectors list only built seasons and require an explicit choice.

## Generate a season when you choose

Choose the season yourself. `2025` below is an example, not a default.

```sh
make data SEASON=2025

# Faster development build: selected teams, plus league-wide fallback data
.venv/bin/nflsim data build --season 2025 --teams PHI KC --seed 25 --iterations 3

.venv/bin/nflsim data list
.venv/bin/nflsim data validate --season 2025
```

A build downloads that season's play-by-play once, caches the raw snapshot, generates offense/defense distributions and coach probabilities, compiles the C++ solvers, calculates EPs and rankings, validates output, then imports it into local SQLite. Builds can take considerable time; progress is printed and a detailed log is written under `data/build/`.

Outputs live under `data/seasons/<season>/`. Each manifest records selected teams, seed, threshold, iterations, toolchain versions, raw/source hashes, and artifact checksums. Repeating a build with the same cached raw snapshot, lockfiles, source, parameters, and toolchain makes the calculation reproducible. Upstream data can change; refreshing deliberately creates a new snapshot.

A build refuses to overwrite an existing season. Replacement is explicit:

```sh
.venv/bin/nflsim data rebuild --season 2025 --teams PHI KC --seed 25
# Add --refresh only when you want to download a fresh upstream snapshot.
```

Rebuild failures restore the previous season artifacts and leave the previously imported database available. To restore the local database from a copied/generated artifact directory:

```sh
.venv/bin/nflsim data import --season 2025
```

Import expects `data/seasons/2025/` (or the corresponding `NFLSIM_DATA_DIR`). Use the same team set when reproducing a build; rebuilding with a subset replaces that season's team set.

## Run games or training explicitly

```sh
.venv/bin/nflsim simulate --season 2025 --team1 PHI --team2 KC --games 100 --plays 150 --seed 25
.venv/bin/nflsim play --season 2025 --team1 PHI --team2 KC --mode 1

# Requires make setup-training; writes ignored checkpoint/metrics files
.venv/bin/nflsim train --season 2025 --team1 PHI --team2 KC --episodes 10000 --seed 25
```

`play`, `simulate`, and `train` default to clock-based games. `--plays` is used only with `--timing-mode plays`. Ties contribute half a win to batch win probability. A trained checkpoint is optional: the AI coach uses generated optimal EP actions until a checkpoint exists. The API never trains a model on startup. See [modeling conventions](docs/architecture.md#modeling-and-behavior-changes) for changes from the old implementation.

## Clock games, team special teams, and actual schedules

```sh
# Upgrade an existing season from its cached raw snapshot; no full EP rebuild
.venv/bin/nflsim data special-teams --season 2025

# Explicitly fetch the actual regular-season schedule, then simulate it
.venv/bin/nflsim schedule fetch --season 2025
.venv/bin/nflsim schedule list --season 2025 --team PHI
.venv/bin/nflsim season simulate --season 2025 --seed 25
# Include qualification and the postseason through the Super Bowl
.venv/bin/nflsim season simulate --season 2025 --seed 25 --playoffs
```

The shared engine now supports quarters, halftime, timeouts, clock runoff, kneels,
and regular-season overtime. Matchup outcomes combine league-relative offense and
defense effects. New builds generate smoothed team field-goal, XP, kickoff, and
punt/muff profiles. Existing seasons remain usable with league fallbacks; the
special-teams upgrade retains previously calculated EP tables. Schedule simulation
uses stable per-game seeds. CLI results are written only with explicit `--output`.
See [simulation design and limitations](docs/simulation.md) for all commands,
modeling assumptions, compatibility behavior, and the difference between a profile
upgrade and a full rebuild.

## APIs

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Provider, available seasons, policy mode |
| `GET /metadata` | Season manifests and generated rankings |
| `POST /expected-points` | EP curve for team/season/down/distance/side |
| `POST /decisions` | Coach probabilities and optimal play choices |
| `POST /advance` | Advance one interactive game state |
| `POST /simulate` | Seeded batch simulation, including cross-season matchups |
| `POST /predict` | Neural or generated EP strategy choice |

Examples, request fields, and error handling are in [docs/api.md](docs/api.md). The OpenAPI docs at `/docs` are generated from validated request models. The existing web routes remain available through Next.js proxies, so browsers never need storage credentials.

## Optional Supabase

The engine and analytics do not import Supabase or SQL clients. Change the provider through configuration; publication is a separate manual operation. See [docs/storage.md](docs/storage.md) for the schema and commands. No migration or cloud publication runs automatically.

For local container deployment of the API:

```sh
docker compose up --build
```

This mounts `./data` read-only and runs the API on port 8000. It does not generate data or start the frontend.

## Development checks

```sh
make check # Offline synthetic tests, lint, and TypeScript checks
make build # Frontend production build; no database credentials required
```

Tests use fabricated season records and mocked HTTP responses. They never download NFL data, publish to Supabase, train models, or run real matchups. C++ is needed for the synthetic solver regression; R parsing is checked when R is installed.

## Layout

- `src/nflsim/`: configuration, domain models, shared engine, analytics, storage adapters, API, CLI, training.
- `pipeline/`: maintained R preparation scripts, C++ EP solvers, pinned R dependencies.
- `frontend/nfl-app/`: Next.js app, same-origin API proxies, generated-season UI.
- `migrations/`: optional cloud adapter schema, applied manually.
- `tests/`: offline contracts and regression coverage.
- `research/archive/`: original notebook source with embedded historical outputs removed; uses the old layout and is retained for reference.
- `data/`: generated, ignored raw snapshots, season artifacts, SQLite, binaries, logs, optional models.

Historical generated data has been removed from the current working tree. Git history remains intact. Changes are not pushed without explicit approval.

Play-by-play data is provided by [nflfastR/nflverse](https://nflfastr.com/). Built by Mihir Kondapalli.

The text player preserves the original field display, EP readout, team prompts,
pauses, and drive summary. Use `--mode 0` for human versus human, `1` for human
versus CPU (default), `2` for CPU versus CPU with pauses, `3` without pauses,
or `4` for NFL AI versus CPU. Enter `0` at a play or continue prompt to end
the game. Conversion choices are `1` for XP and `2` for two points. The shared
play distributions do not retain completion or sack labels, so those end-game
statistics are reported as unavailable. Season selection remains explicit.
