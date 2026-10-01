# API examples

Start the API with `make api`. Full schemas are available at `http://localhost:8000/docs`. These commands are examples for you to invoke; `2025` is explicitly selected. All teams/seasons must have been generated or published through the chosen provider.

## Inspect available data

```sh
curl http://localhost:8000/health
curl http://localhost:8000/metadata
```

`metadata` returns `seasons` (manifest objects) and `rankings` keyed by season and team. An empty local installation returns empty collections and remains healthy.

## Expected points and coach decisions

```sh
curl http://localhost:8000/expected-points \
  -H 'Content-Type: application/json' \
  -d '{"team":"PHI","year":2025,"isDefense":false,"down":1,"distance":10}'

curl http://localhost:8000/decisions \
  -H 'Content-Type: application/json' \
  -d '{"team":"PHI","year":2025,"isDefense":false,"down":4,"distance":3}'
```

Both return `{ "data": [...], "error": null }`. Curves choose the requested distance at each yardline, using goal-to-go near the endzone. Modeled distance is capped at 20. Optimal choices in API responses are `1=run`, `2=pass`, `3=field goal`, `4=punt`; stored C++ choices are zero-based. Zero EP values are preserved.

## Batch simulation

```sh
curl http://localhost:8000/simulate \
  -H 'Content-Type: application/json' \
  -d '{"team1":"PHI","team2":"KC","year1":2025,"year2":2025,"num_games":100,"timing_mode":"clock","seed":25}'
```

Returns `win_probability`, both score arrays, and both averages. Games are bounded to 1–1,000. Clock mode is the default; `num_plays` (1–500) applies only with `timing_mode: "plays"`. Results also include play counts, overtime flags, timing mode, and the matchup-model identifier. Matching seeds and datasets reproduce results. `year1` and `year2` can differ when both datasets are available. NFL/league matchups are supported through team code `NFL`; aliases `LA`/`LAR` normalize to `LAR`.

## Interactive play

```sh
curl http://localhost:8000/advance \
  -H 'Content-Type: application/json' \
  -d '{"state":{"team1":"PHI","team2":"KC","year1":2025,"year2":2025,"coach1":"Human","coach2":"KC","time":3600,"period":1,"timing_mode":"clock"},"choice":0,"seed":25}'
```

Returns `[newState, buttonStatus]`. Pass `newState` back on your next request; this endpoint is stateless. `seed` is optional per request; supply it to replay a single step.

Choices: `0=initial kickoff`, `-1=continue kickoff or computer coach`, `1=run`, `2=pass`, `3=field goal`, `4=punt`, `5=timeout`, `6=kneel`, `-2=extra point`, `-3=two-point conversion`. Human drives require a chosen play. Extra points require `pending_xp=true`; final-play touchdowns still permit conversion attempts.

Button statuses: `-1=kickoff/continue`, `0=finished`, `1=normal play`, `2=conversion`. Initial kickoff is determined from `state.drive=false`, so the default state returned by the request model is valid.

Game state includes scores, team/year/coach pairs, remaining seconds in clock mode or plays in compatibility mode (`time`), down, distance, yardline (`loc`), first-down target, possession (`1` or `-1`), drive status, message, and pending conversion. Active-drive distance must equal `loc - target`; yardlines measure yards to the opponent's endzone. Coaches can be `Human`, `AI`, or an available team code from that side's season.

Clock states also include `period`, `opening_receiver`, `clock_running`, both timeout counts, `ot_completed`, `finished`, `plays_elapsed`, and `safety_kick`. Return all fields unchanged except through engine actions. Direct clients omitting `timing_mode` retain the legacy plays-mode contract; the browser explicitly sends clock mode.

## Strategy prediction

```sh
curl http://localhost:8000/predict \
  -H 'Content-Type: application/json' \
  -d '{"team":"PHI","year":2025,"down":4,"distance":2,"loc":20,"time":30,"score_diff":3,"seed":25}'
```

Returns `{ "action": 1 }` (action varies with state/data). Uses the optional checkpoint at `NFLSIM_MODEL_PATH`; without weights, uses the generated optimal EP choice. Neural inference requires the optional training dependencies. The API never trains or downloads weights.

## Errors

Responses use FastAPI's `detail` field: 422 for invalid request schemas, 400 for illegal actions/unknown teams, 404 for unavailable season/team/situation data, 503 for unavailable hosted storage. Validation errors can contain an array of field errors. Missing data is not silently replaced with random plays or fabricated EPs.

The web app retains `/api/fetchEPs`, `/api/fetchDecisions`, `/api/advance`, `/api/simulate`, and `/api/metadata`; Next.js forwards these to the configured backend.

In interactive `/advance` responses, a touchdown by a CPU-controlled team also
resolves its conversion automatically. The returned message includes both plays;
human-controlled teams still receive a pending conversion and choose XP or two
points. CPU coaches normally kick, but attempt two points when trailing by one or
two after a touchdown in the final two minutes of Q4, in overtime, or with five
plays or fewer remaining in plays mode. This is a simple score-based policy, not
a trained conversion strategy. Touchdown rushing/passing yardage is capped at the
pre-snap distance to the goal line in play messages and console statistics.


## Season simulation UI endpoints

- `POST /season/schedule`: `{ "season": 2025 }`. Explicitly fetch/cache the schedule;
  neither startup nor viewing results downloads anything.
- `POST /season/simulate`: `{ "season": 2025, "seed": 25, "playoffs": true }`.
  Requires cached matchups and all participating teams. Returns HTTP 202 with a
  job `id`, `status`, `completed`, and `total`.
- `GET /season/jobs/{id}`: progress and latest score; completed jobs include
  `result` in memory, failures include `error`.
- `GET /season/results?season=2025`: list complete saved web and CLI runs.
- `GET /season/results/{filename}`: full saved standings, games, and optional playoffs.

One season job runs per API process, with at most eight recent job statuses kept
in memory, including completed results. Jobs and results do not survive an API
restart and are evicted as newer jobs replace them. No results are written to disk. The local UI polls rather than holding
one long HTTP connection. Multiple API workers do not share job state, so use a
single API process for this local workflow. No cloud publication occurs.

`POST /simulate` accepts optional `include_drives: true`. Its `drives` list has
one entry per simulated game, each containing drive summaries and event messages.
Recording defaults off for existing batch clients. New season runs enable it and
include `drives` on each regular-season and playoff game. Older saved games may omit
this field or have `null`; consumers should show that the report is unavailable.
