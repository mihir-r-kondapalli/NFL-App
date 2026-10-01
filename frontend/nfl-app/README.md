# 4th & Sim web app

Run setup and both services from the repository root with `make setup` and `make dev`.

The app reads available seasons/rankings from `/api/metadata`. Its server-only routes forward requests to FastAPI using `API_URL` (default `http://127.0.0.1:8000`). No storage credentials are required by the frontend. Copy `.env.example` to `.env.local` only if the backend address differs.

From this directory: `npm run dev`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm start`.

See the root [README](../../README.md) for explicit generation, simulation, training, and optional hosted-storage commands.
