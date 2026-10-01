# Repository workflow

- Never push Git changes unless the user explicitly approves that push.
- Do not download season data, run real games, train models, or publish to Supabase automatically. Leave these commands for the user unless explicitly requested.
- Keep season selection explicit. Data build/import/publish commands must require `--season`.
- Keep generated data, models, local credentials, and compiled binaries out of Git.
- Business logic consumes the Repository interface. Database-specific behavior belongs in storage adapters.
- Use the shared engine for interactive play, batch simulation, console play, and training.
- Validate changes with offline synthetic fixtures, Python tests, lint, TypeScript checks, and the frontend build.
