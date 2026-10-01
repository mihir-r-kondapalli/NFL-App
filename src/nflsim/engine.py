"""One football state machine for the browser, batch games, console, and training.

Yardlines measure distance to the opponent's endzone. Time is seconds in clock mode.
Turnover samples retain the legacy -1100 (fumble) / -2100 (interception) encoding.
"""

from .drive_report import DriveReport
import random
from functools import lru_cache

from .clock import period_seconds, presnap, resolve_period, tick
from .matchup import matchup_pdf
from .config import normalize_team
from .models import GameState
from .storage import DataUnavailable, Repository, require_team


def yardline_bin(loc):
    if loc <= 20:
        return str(loc)
    for low, high in (
        (21, 23),
        (24, 27),
        (28, 32),
        (33, 38),
        (39, 44),
        (45, 50),
        (51, 70),
        (71, 85),
        (86, 99),
    ):
        if low <= loc <= high:
            return f"{low}-{high}"
    raise ValueError("Yardline must be 1-99")


def pdf(entry):
    values, cdf = entry["values_json"], entry["cdf_json"]
    if not isinstance(values, list):
        values = [values]
    if not isinstance(cdf, list):
        cdf = [cdf]
    if not values or len(values) != len(cdf):
        raise DataUnavailable("Empty or malformed play distribution")
    previous, result = 0, {}
    for value, probability in zip(values, cdf):
        mass = probability - previous
        if mass < 0:
            raise DataUnavailable("Play CDF must be monotonic")
        result[value] = result.get(value, 0) + mass
        previous = probability
    if abs(previous - 1) > 0.001:
        raise DataUnavailable("Play CDF must end at 1")
    return result


class Engine:
    def __init__(self, repo: Repository, predictor=None):
        self.repo = repo
        self.predictor = predictor

    @lru_cache(maxsize=256)
    def _rows(self, table, year, team, defense=False):
        team = require_team(self.repo, year, team)
        return self.repo.rows(table, year=year, team=team, is_defense=defense)

    @lru_cache(maxsize=256)
    def _situations(self, table, year, team, defense=False):
        return {
            (
                r["down"],
                r["distance"],
                r.get("yardline", r.get("yardline_bin")),
                r.get("play_type"),
            ): r
            for r in self._rows(table, year, team, defense)
        }

    @lru_cache(maxsize=32)
    def _special(self, year):
        return {r["yardline"]: r for r in self.repo.rows("special_teams", year=year)}

    @lru_cache(maxsize=128)
    def profile(self, year, team):
        rows = self.repo.rows("team_profiles", year=year, team=team)
        return rows[0]["profile_json"] if rows else {}

    def special(self, state, kicking=False):
        possession = -state.possession if kicking else state.possession
        year = state.year1 if possession == 1 else state.year2
        team = state.team1 if possession == 1 else state.team2
        return year, self.profile(year, team)

    def live(self, state):
        return not state.finished and (state.time > 0 or state.pending_xp)

    def phase_status(self, state):
        return (
            2 if state.pending_xp else (0 if not self.live(state) else (1 if state.drive else -1))
        )

    def validate_matchup(self, state):
        self._validate_teams(state.year1, state.team1, state.year2, state.team2)

    @lru_cache(maxsize=1024)
    def _validate_teams(self, year1, team1, year2, team2):
        require_team(self.repo, year1, team1)
        require_team(self.repo, year2, team2)

    def ep(self, year, team, down, distance, loc):
        row = self._situations("expected_points", year, normalize_team(team)).get(
            (down, min(20, distance, loc), loc, None)
        )
        if row is None:
            raise DataUnavailable(f"Missing EP for {team} {year}: {down}, {distance}, {loc}")
        return row

    def choose(self, state, rng):
        coach = state.coach1 if state.possession == 1 else state.coach2
        team = state.team1 if state.possession == 1 else state.team2
        year = state.year1 if state.possession == 1 else state.year2
        if coach == "Human":
            raise ValueError("Choose a play to advance a human-controlled drive")
        allowed = [1, 2, 3, 4]
        if state.timing_mode == "clock":
            remaining = period_seconds(state)
            diff = (state.score1 - state.score2) * state.possession
            opponent_timeouts = state.timeouts2 if state.possession == 1 else state.timeouts1
            if (
                state.period in (4, 5)
                and diff > 0
                and state.down < 4
                and not opponent_timeouts
                and remaining <= (4 - state.down) * 40 + 3
            ):
                return 6  # Kneel to protect a late lead.
            must_score = diff < 0 and (
                (state.period == 4 and remaining <= 120) or state.period == 5
            )
            if must_score:
                allowed.remove(4)  # Giving away possession cannot secure the needed score.
                # A field goal can tie/win when down 1–3. In regulation only,
                # it can also be the first of multiple scores with >30 seconds left.
                useful_fg = diff >= -3 or (state.period == 4 and diff <= -9 and remaining > 30)
                if not useful_fg:
                    allowed.remove(3)
                if remaining <= 8 and 3 not in allowed:
                    return 2  # Need a touchdown on the last snap, not a clock-burning run.
            if state.period in (2, 4, 5) and remaining <= 8 and state.loc <= 50:
                if 3 in allowed:
                    return 3
            if state.loc > 50:
                allowed = [action for action in allowed if action != 3]
            # When chasing a score, preserve early downs unless the clock forces a kick.
            if must_score and state.down < 4:
                allowed = [action for action in allowed if action != 3]
        if coach == "AI":
            prediction = self.predictor(state, rng) if self.predictor else None
            if prediction is None:
                prediction = (
                    self.ep(year, team, state.down, state.distance, state.loc)["opt_choice"] + 1
                )
            return prediction if prediction in allowed else 2
        row = self._situations("coach_decision_probs", year, normalize_team(coach)).get(
            (state.down, min(20, state.distance, state.loc), state.loc, None)
        )
        if row is None:
            raise DataUnavailable(f"Missing coaching data for {coach} in {year}")
        weights = [
            row[k] if action in allowed else 0
            for action, k in enumerate(("run_prob", "pass_prob", "kick_prob", "punt_prob"), start=1)
        ]
        if not sum(weights):
            return 2  # Historical policy may put all its weight on a now-forbidden kick.
        return rng.choices([1, 2, 3, 4], weights)[0]

    @lru_cache(maxsize=8192)
    def distribution(self, offense, defense, year, def_year, key):
        off = self._situations("play_cdf", year, offense).get(key)
        deff = self._situations("play_cdf", def_year, defense, True).get(key)
        ol = self._situations("play_cdf", year, "NFL").get(key)
        dl = self._situations("play_cdf", def_year, "NFL", True).get(key)
        if any(r is None for r in (off, deff, ol, dl)):
            raise DataUnavailable("Missing matchup/league distribution. Rebuild the season.")
        probabilities = matchup_pdf(pdf(off), pdf(deff), pdf(ol), pdf(dl))
        return tuple(probabilities), tuple(probabilities.values())

    def sample(self, state, play, rng):
        if state.possession == 1:
            offense, defense, year, def_year = state.team1, state.team2, state.year1, state.year2
        else:
            offense, defense, year, def_year = state.team2, state.team1, state.year2, state.year1
        key = (state.down, min(20, state.distance, state.loc), yardline_bin(state.loc), play)
        values, weights = self.distribution(offense, defense, year, def_year, key)
        return rng.choices(values, weights)[0]

    def score(self, state, points):
        if state.possession == 1:
            state.score1 += points
        else:
            state.score2 += points

    def new_downs(self, state):
        state.down = 1
        state.target = max(0, state.loc - 10)
        state.distance = state.loc - state.target

    def switch(self, state):
        state.possession *= -1
        state.loc = 100 - state.loc
        self.new_downs(state)

    def touchdown(self, state, message):
        self.score(state, 6)
        state.loc = 0
        state.drive = False
        state.pending_xp = True
        state.message = message + " TOUCHDOWN!"

    def conversion_choice(self, state):
        """Simple CPU policy: chase a tying/winning two points late; otherwise kick."""
        margin = (state.score1 - state.score2) * state.possession
        late = (
            (state.period == 5 or (state.period == 4 and state.time <= 120))
            if state.timing_mode == "clock"
            else state.time <= 5
        )
        return -3 if late and margin in (-2, -1) else -2

    def advance_interactive(self, state, choice, rng=None):
        """Finish a CPU conversion in the scoring request, preserving both messages."""
        rng = rng or random.Random()
        updated, status = self.advance(state, choice, rng)
        coach = updated.coach1 if updated.possession == 1 else updated.coach2
        if updated.pending_xp and coach != "Human":
            touchdown_message = updated.message
            updated, status = self.advance(updated, self.conversion_choice(updated), rng)
            updated.message = touchdown_message + " " + updated.message
        return updated, status

    def advance(self, state, choice, rng=None):
        rng = rng or random.Random()
        state = state.model_copy(deep=True)
        self.validate_matchup(state)
        if state.opening_receiver is None:
            state.opening_receiver = state.possession
        if state.finished:
            return state, 0
        old_possession = state.possession
        old_scores = (state.score1, state.score2)
        old_period = state.period
        if state.pending_xp:
            if choice == -1:
                choice = self.conversion_choice(state)
            if choice not in (-2, -3):
                raise ValueError("Choose an extra point or two-point conversion")
            _, profile = self.special(state)
            made = rng.random() < (profile.get("xp_prob", 0.945) if choice == -2 else 0.45)
            self.score(state, (1 if choice == -2 else 2) if made else 0)
            state.message = ("XP" if choice == -2 else "2PT conversion") + (
                " made!" if made else " missed!"
            )
            state.pending_xp = False
            state.possession *= -1
            if state.period == 5:
                state.ot_completed |= 1 if old_possession == 1 else 2
            resolve_period(state, rng)
            return state, self.phase_status(state)
        if choice in (-2, -3):
            raise ValueError("Extra points are only available after a touchdown")
        resolve_period(state, rng)
        if not self.live(state):
            return state, 0
        if not state.drive:
            if choice not in (-1, 0):
                raise ValueError("Continue to receive the kickoff before choosing a play")
            state.drive = True
            kick_year, profile = self.special(state, kicking=True)
            outcomes = profile.get("kickoffs", [])
            if outcomes and not state.safety_kick:
                outcome = rng.choices(outcomes, [r["weight"] for r in outcomes])[0]
                state.loc = outcome["loc"]
                touchdown = outcome.get("td", False)
                touchback = outcome.get("touchback", False)
            else:
                state.loc = (
                    rng.randint(66, 75)
                    if state.timing_mode == "plays"
                    else (
                        65
                        if kick_year >= 2025
                        else 70
                        if kick_year == 2024
                        else 75
                        if kick_year >= 2016
                        else 80
                    )
                )
                touchdown, touchback = False, not state.safety_kick
            state.safety_kick = False
            self.new_downs(state)
            state.message = f"Kickoff received at {state.loc}."
            if state.timing_mode == "clock":
                tick(state, 0 if touchback else rng.randint(5, 12))
                state.clock_running = False
            if touchdown:
                self.touchdown(state, "Kickoff returned for a")
                if state.period == 5 and (
                    state.ot_completed == 3
                    or min(state.year1, state.year2) < (2022 if state.postseason else 2025)
                ):
                    state.finished = True
                    state.pending_xp = False
                    state.time = 0
            resolve_period(state, rng)
            return state, self.phase_status(state)
        if choice == 5:
            if state.timing_mode != "clock":
                raise ValueError("Timeouts require clock mode")
            key = "timeouts1" if state.possession == 1 else "timeouts2"
            if not getattr(state, key):
                raise ValueError("No timeouts remaining")
            setattr(state, key, getattr(state, key) - 1)
            state.clock_running = False
            state.message = "Offense calls timeout."
            return state, 1
        if state.timing_mode == "clock" and presnap(state, rng):
            return state, self.phase_status(state)
        if choice == -1:
            choice = self.choose(state, rng)
        if choice not in (1, 2, 3, 4, 6):
            raise ValueError("Choose run, pass, field goal, or punt")
        if choice == 3 and state.loc > 50:
            raise ValueError("Field goal attempts require yardline 50 or closer")
        state.plays_elapsed += 1
        snap_seconds = period_seconds(state)
        if state.timing_mode == "plays":
            state.time -= 1
        else:
            tick(
                state,
                rng.randint(4, 8) if choice in (1, 2) else rng.randint(5, 10) if choice == 4 else 3,
            )
        gain = None
        if choice in (1, 2, 6):
            gain = -1 if choice == 6 else self.sample(state, "rush" if choice == 1 else "pass", rng)
            if gain <= -1000:
                kind = "Interception" if gain <= -2000 else "Fumble"
                gain += 2100 if gain <= -2000 else 1100
                state.loc -= gain
                self.switch(state)
                if state.loc <= 0:
                    self.touchdown(state, kind + " returned for a")
                elif state.loc >= 100:
                    state.loc = 80
                    self.new_downs(state)
                    state.message = kind + ". Touchback."
                else:
                    state.message = kind + ". Possession changed."
            else:
                gain = min(gain, state.loc)
                state.loc -= gain
                label = "Kneel" if choice == 6 else "Run" if choice == 1 else "Pass"
                state.message = f"{label} for {gain} yards."
                if state.loc <= 0:
                    self.touchdown(state, state.message)
                elif state.loc >= 100:
                    state.loc = 100
                    state.possession *= -1
                    self.score(state, 2)
                    state.drive = False
                    state.safety_kick = True
                    state.message += " SAFETY!"
                elif state.loc <= state.target:
                    self.new_downs(state)
                    state.message += " First down!"
                elif state.down == 4:
                    self.switch(state)
                    state.message += " Turnover on downs."
                else:
                    state.down += 1
        elif choice == 3:
            year, profile = self.special(state)
            special = self._special(year).get(state.loc)
            if special is None:
                raise DataUnavailable(f"Missing special teams data for {year}")
            probability = (
                profile.get("fg_probs", [])[state.loc - 1]
                if profile.get("fg_probs")
                else special["kick_prob"]
            )
            if rng.random() < probability:
                self.score(state, 3)
                state.possession *= -1
                state.drive = False
                state.message = "Field goal is GOOD!"
            else:
                state.loc = min(state.loc + 7, 99)
                self.switch(state)
                state.message = "Field goal MISSED!"
        else:
            year, profile = self.special(state)
            special = self._special(year).get(state.loc)
            if special is None or not special["punt_values"]:
                raise DataUnavailable(f"Missing punt data for {year}")
            punt_profile = profile.get("punts", {}).get(str(state.loc))
            punt = (
                rng.choices(punt_profile["values"], punt_profile["weights"])[0]
                if punt_profile
                else rng.choice(special["punt_values"])
            )
            if punt > 1000:
                state.loc -= punt - 1100
                if state.loc <= 0:
                    self.touchdown(state, "Muffed punt recovered for a")
                else:
                    state.loc = min(state.loc, 99)
                    self.new_downs(state)
                    state.message = "Punt muffed. Kicking team retains possession."
            elif punt < -1000:
                state.possession *= -1
                self.touchdown(state, "Punt returned for a")
            else:
                state.loc -= punt
                self.switch(state)
                state.loc = 80 if state.loc >= 100 else max(1, state.loc)
                self.new_downs(state)
                state.message = f"Punt for {punt} yards."
        state.distance = max(0, state.loc - state.target)
        if state.timing_mode == "clock":
            stopped = state.possession != old_possession or not state.drive or choice in (3, 4)
            profile = self.profile(
                state.year1 if old_possession == 1 else state.year2,
                state.team1 if old_possession == 1 else state.team2,
            )
            if choice == 2 and gain == 0:
                stopped |= rng.random() < profile.get("zero_pass_incomplete_prob", 0.85)
            if choice in (1, 2) and not stopped:
                out = rng.random() < profile.get("out_of_bounds_prob", 0.12)
                # Outside late halves the clock restarts on ready-for-play;
                # approximate that administration with a shorter subsequent runoff.
                if (
                    out
                    and state.period in (2, 4, 5)
                    and period_seconds(state) <= (120 if state.period == 2 else 300)
                ):
                    stopped = True
            state.clock_running = not stopped
            if state.period in (2, 4, 5) and snap_seconds > 120 >= period_seconds(state):
                state.clock_running = False
            if state.period == 5:
                ended = state.possession != old_possession or (
                    not state.drive and not state.pending_xp
                )
                if ended:
                    state.ot_completed |= 1 if old_possession == 1 else 2
                defensive_score = (
                    state.possession != old_possession
                    and (state.pending_xp or state.safety_kick)
                    and (state.score1, state.score2) != old_scores
                )
                old_rules_td = (
                    min(state.year1, state.year2) < (2022 if state.postseason else 2025)
                    and state.pending_xp
                    and state.score1 != state.score2
                )
                sudden_death_td = state.pending_xp and state.ot_completed == 3
                if defensive_score or old_rules_td or sudden_death_td:
                    state.finished = True
                    state.pending_xp = False
                    state.time = 0
            resolve_period(state, rng)
            if state.period != old_period:
                state.clock_running = False
        return state, self.phase_status(state)

    def simulate(self, request):
        rng = random.Random(request.seed)
        scores1, scores2, play_counts, overtime = [], [], [], []
        drive_reports = []
        for _ in range(request.num_games):
            state = GameState(
                team1=request.team1,
                team2=request.team2,
                year1=request.year1,
                year2=request.year2,
                coach1=normalize_team(request.team1),
                coach2=normalize_team(request.team2),
                time=request.num_plays if request.timing_mode == "plays" else 3600,
                timing_mode=request.timing_mode,
                postseason=request.postseason,
                possession=rng.choice([-1, 1]),
            )
            report = DriveReport() if request.include_drives else None
            transitions = 0
            while self.live(state):
                transitions += 1
                if transitions > 2000:
                    raise RuntimeError("Game exceeded transition safety limit")
                previous = state
                state, _ = self.advance(state, -1, rng)
                if report is not None:
                    report.observe(previous, state)
            if report is not None:
                drive_reports.append(report.finish())
            scores1.append(state.score1)
            scores2.append(state.score2)
            play_counts.append(state.plays_elapsed)
            overtime.append(state.period == 5)
        wins = sum(1 if a > b else 0.5 if a == b else 0 for a, b in zip(scores1, scores2))
        return dict(
            win_probability=wins / request.num_games,
            team1_scores=scores1,
            team2_scores=scores2,
            avg_score_team1=sum(scores1) / request.num_games,
            avg_score_team2=sum(scores2) / request.num_games,
            play_counts=play_counts,
            overtime=overtime,
            drives=drive_reports,
            timing_mode=request.timing_mode,
            matchup_model="league_relative_product_v1",
            special_teams=dict(
                team1="team_profile"
                if self.profile(request.year1, normalize_team(request.team1))
                else "league_fallback",
                team2="team_profile"
                if self.profile(request.year2, normalize_team(request.team2))
                else "league_fallback",
            ),
        )
