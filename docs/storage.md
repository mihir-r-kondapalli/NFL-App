# Storage adapters

The engine and analytics receive a `Repository` implementing `seasons()` and `rows(table, **filters)`. Records use one normalized schema regardless of the database. The adapters handle SQLite connections, JSON conversion, Supabase HTTP requests, pagination, and publication. To add another provider, implement the same interface and extend the configuration factory in `src/nflsim/storage.py`; API routes and domain behavior stay unchanged.

## Local

The default provider reads `data/nflsim.sqlite3`. `data build` and `data import` always publish locally, regardless of the API's configured read provider. Reads use read-only connections. Publication replaces one season in a transaction; invalid artifacts are rejected before that transaction begins.

Use `NFLSIM_DATA_DIR` to choose a different data root. The API detects local database modifications and invalidates its cached game datasets. There are no season downloads or sample datasets hidden in the read adapter.

## Supabase, when you opt in

1. Apply `migrations/001_supabase.sql` and `migrations/002_team_profiles.sql` manually in your project.
2. Expose the `nflsim` schema through Supabase's Data API settings.
3. Set backend-only credentials in your shell or deployment environment:

```sh
export SUPABASE_URL='https://YOUR_PROJECT.supabase.co'
export SUPABASE_KEY='YOUR_SERVER_SIDE_SERVICE_ROLE_KEY'
export NFLSIM_SUPABASE_SCHEMA='nflsim'
```

The migration uses a separate `nflsim` namespace so it does not overwrite legacy public-schema tables. Row-level security is enabled and access is granted to `service_role`; credentials must remain server-side.

Publication is explicit and replaces the selected season's records in that schema:

```sh
.venv/bin/nflsim data publish --season 2025
```

The command validates local season artifacts first, removes the cloud readiness marker, uploads normalized records in batches, then publishes the season manifest last. PostgREST publication spans multiple requests rather than a database transaction. If upload fails, that season remains unavailable until the explicit publication command is rerun. It does not mutate unrelated seasons.

To use the hosted records for API requests:

```sh
export NFLSIM_DATA_PROVIDER=supabase
make api
```

The frontend only needs `API_URL`; it never receives `SUPABASE_KEY`. Restart the API after replacing a hosted season so cached engine data is refreshed. Local generation, import, and cloud publication remain separate commands.

Neither app startup, tests, setup, nor a season build publishes to Supabase. The optional cloud adapter has been tested through mocked HTTP contracts; no live project is contacted by those tests.
