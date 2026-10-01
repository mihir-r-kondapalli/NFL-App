# Clock games, matchups, special teams, and actual schedules

All commands below are explicit user actions. Installation and API startup do not
download a schedule or PBP, build a season, run games, or train a model.

## Use an existing season

Existing season artifacts remain usable. Clock timing and the matchup model work
with the existing CDFs. Without new profiles, kicking and punts use the existing
league tables, XP probability is 0.945, and clock-mode kickoff touchbacks use the
kicking season's placement rule.

Add team special teams from the raw PBP cached by your completed build:

```sh
.venv/bin/nflsim data special-teams --season 2025
.venv/bin/nflsim data validate --season 2025
```

This command requires the existing raw snapshot, checks its hash against the season
manifest, and refuses to download a replacement. It generates profiles, updates
artifact checksums, and imports them into local SQLite. It retains existing EP
tables, so historical EP-based optimal choices still reflect the old league kicking
assumptions. A future explicit full rebuild incorporates team field goals, weighted
punts, and XP probabilities into offensive EP calculations. Defensive EP preparation
uses league special teams because a defense faces many opponents' kicking units.
Kickoff EP conventions in the C++ solver remain unchanged.

Profile validation runs before import; SQLite updates are transactional. Failed
upgrades restore the prior profile and manifest. Supabase is never changed by this
command. For that provider, apply `migrations/002_team_profiles.sql` manually and
explicitly publish the season afterward.

## Play or simulate

```sh
.venv/bin/nflsim play --season 2025 --team1 PHI --team2 KC --mode 1
.venv/bin/nflsim simulate --season 2025 --team1 PHI --team2 KC --games 100 --seed 25

# Explicit compatibility mode for the previous fixed-play-budget behavior
.venv/bin/nflsim play --season 2025 --team1 PHI --team2 KC --mode 1 --timing-mode plays --plays 150
```

The CLI, browser, and batch API use clock mode by default. `num_plays`/`--plays`
controls only plays mode, not the normal game clock. Direct `/advance` clients that
omit `timing_mode` retain the old plays-mode state contract. To start a clock game,
send `timing_mode: "clock"`, `time: 3600`, and `period: 1`, then return every state
field on subsequent requests. Console and browser human controls include timeout
and kneel; API choices are `5=timeout` and `6=kneel`.

### Clock administration

`time` stores total regulation seconds remaining; `period` identifies Q1–Q4.
During OT, `time` becomes seconds remaining in OT. The display converts this to
the current quarter's minutes and seconds. The initial receiver is recorded so
the other team receives the second-half kickoff.

- Run/pass live time: uniformly 4–8 seconds; kneels/field goals: 3 seconds;
  punts: 5–10 seconds; returned kickoffs: 5–12 seconds; touchbacks and conversions
  consume no game-clock time.
- A running clock uses 25–40 seconds before the next snap, or 8–15 seconds when
  the offense is tied/trailing in the last two minutes of a half/OT. A late
  leading offense uses the full 40 seconds when timeouts do not stop it.
- The clock stops for changes of possession, scoring, incompletions, timeouts,
  quarter boundaries, and two-minute warnings. Late out-of-bounds plays stop it
  in the last two minutes of Q2 or last five minutes of Q4/OT. Outside those
  windows, the model approximates ready-for-play restart with ordinary runoff.
- Quarter boundaries carry the drive into Q2/Q4. Halftime resets possession and
  gives each team three timeouts. Final-play touchdowns finish their conversion
  before halftime/end-of-regulation decisions.
- Automatic clock management spends defensive timeouts against a late lead,
  uses offensive timeouts near expiration, and reduces runoff for a trailing
  offense. CPU coaches can kneel to protect a lead or attempt a late field goal.
- Modern regular-season OT lasts at most ten minutes and gives both teams a
  possession opportunity, subject to clock expiration. Once both possessions
  finish, an unequal score ends the game; otherwise subsequent scoring wins.
  Defensive TDs/safeties can end it immediately. Unequal touchdown scores
  end OT for pre-2025 seasons; regular-season OT before 2012 ends on any
  score, and seasons before 2017 use a fifteen-minute cap. This is not a postseason OT model.

These timing ranges and coaching heuristics are explicit assumptions, not a fitted
timing model. The old CDFs encode yardage and turnovers, not completion or boundary
events. A zero-yard pass is classified as incomplete using the team profile's
observed incomplete fraction among zero-yard passes; boundary events use a smoothed
team rate. Penalties, replay, injuries, spikes, onside kicks, and detailed timeout
strategy are not modeled. The engine has a 2,000-transition safety limit for batch
games; it raises an error rather than reporting a silently truncated game.

### Offense versus defense

The fixed `0.7 * offense + 0.3 * defense` mixture has been replaced by a
league-relative product. For each down/distance/field-position/play-type situation,
let `O` be the offense's outcome distribution, `D` the defense's **allowed** outcome
distribution, and `LO`, `LD` their respective seasons' league distributions:

```text
baseline(v) = sqrt(LO(v) * LD(v))
attack(v)   = 0.85 * O(v) / LO(v) + 0.15
allowed(v)  = 0.85 * D(v) / LD(v) + 0.15
weight(v)   = baseline(v) * clamp(attack(v), 0.25, 4) * clamp(allowed(v), 0.25, 4)
probability(v) = weight(v) / sum(weight)
```

Before those ratios, each PDF receives `0.0001` mass per outcome in the combined
support and is normalized. This makes zero bins safe. The 15% league shrinkage and
bounded ratios prevent rare outcomes from overwhelming a matchup. They are
regularization defaults, not weights learned from historical validation.

Neutral offense and defense reproduce the league distribution. An offense that
produces more positive gains increases those outcomes; a defense that allows fewer
reduces them. Both effects participate symmetrically, and cross-season comparisons
use each season's own baseline. Turnover encodings participate as outcomes too.
The distributions are cached by matchup and situation.

This improves the model structure but does not establish greater predictive
accuracy. Team CDF preparation already pools sparse situations; this adds further
conservative regularization. Historical strength of schedule is still embedded in
the team observations. Opponent-adjusted fitting and held-out-season calibration
would be separate work requiring explicitly authorized historical data/model runs.

### Team special teams

Each selected team and the league get a portable profile. Scalar make rates use
`(team successes + 20 * league rate) / (team attempts + 20)`. Outcome distributions
mix the team's empirical distribution with the league using weights
`n / (n + 20)` and `20 / (n + 20)`. These twenty prior attempts are a modeling
choice, not an empirically tuned constant.

- Field goals use observations within five yardlines, falling back to the league
  sample where needed. Blocked attempts count as failures.
- XP uses that team's made/failed/blocked attempts.
- Kickoffs use the kicking team's touchbacks, receiving field positions, and
  return TD outcomes. nflfastR kickoff `posteam` denotes the receiver, so the
  profile groups by `defteam`, the kicker. Short/onside kicks are excluded.
  Touchback placements follow the modeled season: own 35 in 2025+, own 30 in
  2024, own 25 in 2016–2023, own 20 earlier. Distinct dynamic-kickoff landing-zone
  touchback types are pooled under this approximation.
- Punt distributions retain net yards, touchbacks, return TDs, and receiving-team
  fumbles/muffs recovered by the kicking team. Recovery/fumbling team fields
  identify retained possession. A lost-fumble flag alone does not establish a
  muff. Existing numeric turnover encodings remain compatible.

Returner strength is embedded in the opponents observed in each kicking team's
sample, rather than estimated as a separate receiving-unit rating. Receiver-recovered
muffs remain ordinary net-yard outcomes; blocked kicks and rare multi-fumble plays
are simplified. Existing score/distribution interfaces remain shared by text play,
the browser, batch simulation, and optional training.

Batch results report `special_teams.team1` and `special_teams.team2` as
`team_profile` or `league_fallback`, so callers can see which data was used.
Neural input dimensionality stays at five; seconds are scaled by 24 to keep the
time feature on the old 0–150 scale. Existing checkpoints can load, but were not
trained or calibrated for the new clock and matchup behavior. No training was
performed as part of this change.

## Actual schedules

The explicit fetch command reads the public nflverse schedule:
https://github.com/nflverse/nfldata/blob/master/data/games.csv

```sh
.venv/bin/nflsim schedule fetch --season 2025
.venv/bin/nflsim schedule list --season 2025 --team PHI
.venv/bin/nflsim season simulate --season 2025 --seed 25

# Optional subsets or alternate output path
.venv/bin/nflsim season simulate --season 2025 --week 1 --seed 25
.venv/bin/nflsim season simulate --season 2025 --team PHI --seed 25
.venv/bin/nflsim season simulate --season 2025 --seed 26 --output data/results/2025_seed26.json
```

Fetch caches regular-season matchups, dates, times, home/away roles, and game IDs
under `data/schedules/`. It strips historical scores. Re-fetch uses the cache;
`--refresh` explicitly replaces it after validation. The source URL and source-file
SHA-256 are stored for provenance. Simulation never fetches implicitly.

Validation rejects duplicate games, two appearances by one team in a week,
unknown teams, mixed seasons, and incomplete schedules. It covers the 32-team era
from 2002, expects 16 games per team before 2021 and 17 afterward, and accounts
for the canceled BUF–CIN game in 2022.

Each league schedule row is simulated exactly once through the shared engine.
Team schedules are views of that same list. Every game's seed derives from
season, overall seed, and game ID, so simulating a single team/week reproduces
its corresponding games in the full-season run. All selected teams must have
data before the first game starts. Output includes game scores, play counts,
OT flags, seeds, and standings with wins/losses/ties and points for/against.

Byes follow absent schedule rows. Standings are sorted by win percentage then
team abbreviation for display. The optional postseason uses separate qualification
and seeding logic. Fatigue, roster changes, and a calibrated home advantage are
not implemented. Neutral-site roles are preserved without introducing an
uncalibrated bonus. Team/week subsets are explicitly marked as partial results.


## Playoffs

After building all 32 teams and explicitly fetching the schedule, run:

```sh
.venv/bin/nflsim season simulate --season 2025 --seed 25 --playoffs
```

This runs the regular season and then Wild Card, Divisional, Conference
Championship, and Super Bowl games. Terminal output includes every score,
conference seeds, and the champion. Results are not saved automatically.
To explicitly export a CLI run, pass `--output data/results/my-season.json`.
Its `playoffs` object contains `seeds`, `games`, `conference_champions`, and
`champion`. The top-level games and standings remain regular-season results.
Playoffs cannot be combined with `--team` or `--week`.

Each conference qualifies four division winners plus three wild cards from 2020
onward (two before 2020). Division winners take seeds 1–4. The top seed receives
a bye (top two before 2020); subsequent rounds reseed with the highest remaining
seed hosting the lowest. The Super Bowl is neutral. Qualification uses simulated
results, never historical playoff teams or scores.

Tied records use head-to-head, division/conference/common-opponent records,
strength of victory/schedule, combined scoring rankings, and net points in the
applicable order, restarting after elimination. The last net-touchdown criterion
is unavailable because game results do not record touchdowns: remaining ties use
a reproducible seeded draw. This limitation can change rare qualification outcomes relative to the full
official procedures.

Postseason games use the shared engine with `postseason: true` (also supported by
`POST /simulate` and clock-mode `/advance` states). Overtime uses 15-minute periods
and continues until a winner, retaining the drive and possession opportunities
across period boundaries. Both teams receive an opportunity from 2022 onward;
earlier seasons use their opening-touchdown/sudden-death rules. Teams receive
three timeouts per overtime half. Extremely long games still fail explicitly at
the engine's transition safety limit instead of awarding an arbitrary winner.
The existing approximate clock management applies in postseason too.

Rule references: [NFL tiebreaking procedures](https://www.nfl.com/standings/tie-breaking-procedures)
and [NFL Rule 16](https://operations.nfl.com/media/ntif5hxb/2025-nfl-rulebook-final.pdf).


## Browser season explorer

Open `/simulate` and choose **Full season**. The old `/season` link redirects there. Select a built season,
load its schedule explicitly, choose a seed and whether to include playoffs,
and start a run. Live progress shows completed games and the latest score.
Results and drive reports remain in memory for the current session. Refreshing
the page or restarting the API loses access to the current run; no new simulation
files are created. Existing files are left untouched.

Standings can be viewed through any regular-season week and filtered by league,
conference, or division. Click a team to see its weekly score and full schedule.
The weekly score view includes bye teams. Final playoff seeds, byes, round
matchups, and the champion appear in a connected AFC/NFC bracket in the Playoffs
view, labeled Wild-Card, Divisional, AFC/NFC Championships, and Super Bowl.
Wild-Card positions remain in seed order. Advancement lines follow actual
reseeded matchups rather than fixed future opponents: within each conference,
the highest remaining seed hosts the lowest remaining seed. The Super Bowl is
labeled as a neutral-site game for both participants. Intermediate standings
are not clinching projections; playoff badges appear only at the final week.

Click any weekly scorecard or playoff game to open its drive report. New season
runs record each drive's start/end clock, starting field position, play count,
score, and chronological play messages, including the conversion after a touchdown.
Starting positions use field-side labels: 60 yards to the opponent’s goal is
“Own 40,” 40 yards is the opponent’s 40, and 50 is midfield. Click outside the
report, press Escape, or use Close to dismiss it.
Head-to-head runs also record reports accessible from each game result. Reports
observe the shared engine without changing random draws. Existing result files
without `drives` show an unavailable message; they are never silently rerun.

## Late-game CPU decisions

Historical coach probabilities and EP actions are filtered by the current score
and clock. In Q4's final two minutes, or while trailing in overtime, CPU coaches
cannot punt. A field goal is allowed when trailing by 1–3; in regulation it is
also allowed when trailing by at least nine with more than 30 seconds remaining,
as one part of a multi-score comeback. Otherwise the coach must pursue a touchdown.
When a touchdown is required with eight seconds or fewer left, the CPU passes.
Early-down field goals while trailing are reserved for the last eight seconds.
Halftime field goals and ordinary mid-game choices retain their existing behavior.
These constraints also apply to neural/EP coaches. Historical run/pass weights
are renormalized after disallowed kicks are removed; if none remain, the CPU
passes. This is a situational heuristic, not a calibrated win-probability model.

Drive reports include a 100-yard field graphic, oriented left to right for the
team possessing the ball. A circle marks the drive start, a square marks its end,
and the label identifies TD, field goal made/missed, punt, turnover, safety, or
end of half/game. Punts show a dashed path to a diamond at the receiving team's
possession spot after returns/touchbacks, not the ball's first landing point.
New runs capture `end_yards_to_goal`, optional `kick_end_yards_to_goal`, and
`result`; earlier reports without those fields show the start only and explicitly
mark the endpoint unavailable. All positions are relative to the original offense.
