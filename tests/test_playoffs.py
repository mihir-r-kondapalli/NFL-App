import random

import pytest

from nflsim.clock import resolve_period
from nflsim.models import GameState, SimulationRequest
from nflsim.playoffs import DIVISION, Qualification, simulate_playoffs
from nflsim.schedule import simulate_season
from test_schedule import FakeEngine, synthetic_games
from nflsim.storage import ScheduleRepository


class PlayoffEngine(FakeEngine):
    def simulate(self, request):
        result = super().simulate(request)
        if request.postseason:
            # Make lower seeds win to exercise reseeding after upsets.
            result["team1_scores"], result["team2_scores"] = [10], [20]
        return result


@pytest.mark.parametrize("season,count", [(2019, 11), (2030, 13)])
def test_bracket_byes_reseeding_and_champion(season, count):
    rows = [{**g, "home_score": 14, "away_score": 14} for g in synthetic_games(season)]
    regular = dict(season=season, seed=25, games=rows, complete=True)
    engine = PlayoffEngine()
    result = simulate_playoffs(engine, regular)
    assert len(result["games"]) == count
    assert all(r.postseason for r in engine.calls)
    assert result == simulate_playoffs(PlayoffEngine(), regular)
    for conf, seeds in result["seeds"].items():
        assert len(seeds) == (7 if season >= 2020 else 6)
        assert len({r["division"] for r in seeds[:4]}) == 4
        games = [g for g in result["games"] if g["conference"] == conf]
        wc = [g for g in games if g["game_type"] == "WC"]
        assert all(g["home_seed"] > (1 if season >= 2020 else 2) for g in wc)
        div = [g for g in games if g["game_type"] == "DIV"]
        assert div[0]["home_seed"] == 1
        assert div[0]["away_seed"] == len(seeds)
    assert result["games"][-1]["location"] == "Neutral"
    assert result["champion"] == result["games"][-1]["winner"]


def test_full_season_integration_and_partial_rejection(tmp_path):
    store = ScheduleRepository(tmp_path)
    store.save(2030, synthetic_games(), "fixture", "fixture")
    engine = PlayoffEngine()
    result = simulate_season(engine, store, 2030, playoffs=True)
    assert len(result["games"]) == 272
    assert len(result["playoffs"]["games"]) == 13
    assert len(engine.calls) == 285
    assert sum(r["wins"] + r["losses"] + r["ties"] for r in result["standings"]) == 544
    with pytest.raises(ValueError, match="complete regular season"):
        simulate_season(engine, store, 2030, team="PHI", playoffs=True)


def test_head_to_head_and_division_priority():
    q = Qualification([], 2030, 25)
    q.records["PHI"] = [("DAL", 21, 7), ("KC", 0, 7)]
    q.records["DAL"] = [("PHI", 7, 21), ("KC", 7, 0)]
    assert q.winner(["DAL", "PHI"], division=True) == "PHI"
    assert set(DIVISION) == set(q.records)


def test_overtime_continues_second_possession_and_ties():
    state = GameState(
        team1="PHI",
        team2="KC",
        year1=2030,
        year2=2030,
        timing_mode="clock",
        postseason=True,
        period=4,
        time=0,
    )
    resolve_period(state, random.Random(25))
    assert (state.period, state.time, state.timeouts1) == (5, 900, 3)
    state.time, state.score1, state.ot_completed = 0, 7, 1
    resolve_period(state, random.Random(25))
    assert not state.finished and state.time == 900 and state.ot_period == 2
    state.score2, state.ot_completed, state.time = 7, 3, 0
    resolve_period(state, random.Random(25))
    assert not state.finished and state.ot_period == 3
    state.score2 = 10
    resolve_period(state, random.Random(25))
    assert state.finished


def test_postseason_rejects_play_budget():
    with pytest.raises(ValueError, match="clock mode"):
        SimulationRequest(
            team1="PHI", team2="KC", year1=2030, year2=2030, postseason=True, timing_mode="plays"
        )


@pytest.mark.parametrize(
    "season,mask", [(2030, m) for m in range(8)] + [(2019, m) for m in range(4)]
)
def test_every_wildcard_upset_combination_reseeds(season, mask):
    class UpsetEngine(PlayoffEngine):
        def simulate(self, request):
            index = len(self.calls)
            result = super().simulate(request)
            wc_count = 3 if season >= 2020 else 2
            conference_game_count = wc_count + 3
            round_index = index % conference_game_count
            away_wins = round_index < wc_count and bool(mask & (1 << round_index))
            result["team1_scores"] = [10 if away_wins else 24]
            result["team2_scores"] = [24 if away_wins else 10]
            return result

    regular = dict(
        season=season,
        seed=25,
        complete=True,
        games=[{**g, "home_score": 14, "away_score": 14} for g in synthetic_games(season)],
    )
    result = simulate_playoffs(UpsetEngine(), regular)
    for conference, seeds in result["seeds"].items():
        rank = {s["team"]: s["seed"] for s in seeds}
        games = [g for g in result["games"] if g["conference"] == conference]
        byes = 1 if season >= 2020 else 2
        remaining = [s["team"] for s in seeds[:byes]] + [
            g["winner"] for g in games if g["game_type"] == "WC"
        ]
        remaining.sort(key=rank.get)
        divisional = [g for g in games if g["game_type"] == "DIV"]
        assert [(g["home_team"], g["away_team"]) for g in divisional] == [
            (remaining[0], remaining[-1]),
            (remaining[1], remaining[-2]),
        ]
        finalists = sorted([g["winner"] for g in divisional], key=rank.get)
        championship = next(g for g in games if g["game_type"] == "CON")
        assert (championship["home_team"], championship["away_team"]) == tuple(finalists)
