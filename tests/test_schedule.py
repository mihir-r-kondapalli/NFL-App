import csv
import io
import random

import httpx
import pytest

from nflsim.cli import parser
from nflsim.config import TEAMS
from nflsim.schedule import fetch_schedule, simulate_season, validate_games, write_results
from nflsim.storage import ScheduleRepository


def synthetic_games(season=2030):
    games = []
    for week in range(1, 18):
        for index in range(0, 32, 2):
            games.append(
                dict(
                    game_id=f"{season}_{week}_{index}",
                    season=season,
                    game_type="REG",
                    week=week,
                    home_team=TEAMS[index],
                    away_team=TEAMS[index + 1],
                    gameday="2030-09-01",
                    gametime="13:00",
                    location="Home",
                )
            )
    return games


def test_explicit_schedule_season_required():
    for args in (
        ["schedule", "fetch"],
        ["schedule", "list"],
        ["season", "simulate"],
        ["data", "special-teams"],
    ):
        with pytest.raises(SystemExit):
            parser().parse_args(args)


def test_schedule_fetch_is_cached_and_strips_actual_scores(tmp_path, monkeypatch):
    rows = [{**g, "home_score": 30, "away_score": 20} for g in synthetic_games()]
    # The upstream uses LA for the Rams; imported schedules use canonical LAR.
    for row in rows:
        for side in ("home_team", "away_team"):
            if row[side] == "LAR":
                row[side] = "LA"
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    calls = []

    def get(url, **kwargs):
        calls.append(url)
        return httpx.Response(200, text=stream.getvalue(), request=httpx.Request("GET", url))

    monkeypatch.setattr("nflsim.schedule.httpx.get", get)
    store = ScheduleRepository(tmp_path)
    games = fetch_schedule(store, 2030)
    assert len(games) == 272 and all("home_score" not in g for g in games)
    assert any("LAR" in (g["home_team"], g["away_team"]) for g in games)
    assert fetch_schedule(store, 2030) == games and len(calls) == 1
    assert fetch_schedule(store, 2030, refresh=True) == games and len(calls) == 2


def test_schedule_rejects_duplicates_partial_seasons_and_wrong_teams():
    games = synthetic_games()
    validate_games(games, 2030)
    with pytest.raises(ValueError, match="Incomplete"):
        validate_games(games[:-1], 2030)
    with pytest.raises(ValueError, match="Duplicate"):
        validate_games(games + [games[0]], 2030)
    with pytest.raises(ValueError, match="two different"):
        validate_games([{**games[0], "away_team": games[0]["home_team"]}], 2030, complete=False)
    with pytest.raises(ValueError, match="season/type"):
        validate_games([{**games[0], "season": 2025}], 2030, complete=False)


class FakeEngine:
    def __init__(self):
        self.calls = []
        self.validations = []

    def validate_matchup(self, state):
        self.validations.append((state.team1, state.team2))

    def simulate(self, request):
        self.calls.append(request)
        rng = random.Random(request.seed)
        return dict(
            team1_scores=[rng.randint(0, 40)],
            team2_scores=[rng.randint(0, 40)],
            play_counts=[130],
            overtime=[False],
        )


def test_each_game_once_standings_and_filter_stable_seeds(tmp_path):
    store = ScheduleRepository(tmp_path / "schedules")
    store.save(2030, synthetic_games(), "synthetic", "fixture")
    engine = FakeEngine()
    full = simulate_season(engine, store, 2030)
    assert len(engine.calls) == len(engine.validations) == 272
    assert len({request.seed for request in engine.calls}) == 272
    assert all(request.timing_mode == "clock" for request in engine.calls)
    assert full["complete"] and len(full["standings"]) == 32
    assert all(r["wins"] + r["losses"] + r["ties"] == 17 for r in full["standings"])
    assert sum(r["points_for"] for r in full["standings"]) == sum(
        r["points_against"] for r in full["standings"]
    )
    team = simulate_season(FakeEngine(), store, 2030, team="PHI")
    assert not team["complete"] and len(team["games"]) == 17
    by_id = {g["game_id"]: g for g in full["games"]}
    assert all(game == by_id[game["game_id"]] for game in team["games"])
    week = simulate_season(FakeEngine(), store, 2030, week=1)
    assert len(week["games"]) == 16
    output = tmp_path / "results" / "season.json"
    write_results(output, full)
    assert output.exists() and not output.with_suffix(".json.tmp").exists()


def test_missing_schedule_never_triggers_fetch(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "nflsim.schedule.httpx.get", lambda *a, **k: pytest.fail("Unexpected network")
    )
    with pytest.raises(ValueError, match="No regular-season schedule"):
        simulate_season(FakeEngine(), ScheduleRepository(tmp_path), 2030)
