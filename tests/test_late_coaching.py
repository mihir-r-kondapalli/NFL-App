import random

import pytest

from conftest import MemoryRepository
from nflsim.engine import Engine
from nflsim.models import GameState


def situation(deficit=6, seconds=5, period=4, possession=1, coach="PHI", **extra):
    fields = dict(
        team1="PHI",
        team2="KC",
        year1=2030,
        year2=2030,
        coach1=coach,
        coach2=coach,
        timing_mode="clock",
        period=period,
        time=seconds + ((4 - period) * 900 if period < 5 else 0),
        score1=0 if possession == 1 else deficit,
        score2=deficit if possession == 1 else 0,
        possession=possession,
        drive=True,
        down=4,
        loc=30,
        target=26,
        distance=4,
    )
    fields.update(extra)
    return GameState(**fields)


def engine_with_policy(monkeypatch, action):
    engine = Engine(MemoryRepository())
    row = dict(run_prob=0, pass_prob=0, kick_prob=0, punt_prob=0)
    row[["run_prob", "pass_prob", "kick_prob", "punt_prob"][action - 1]] = 1

    class Situations(dict):
        def get(self, key):
            return row

    monkeypatch.setattr(engine, "_situations", lambda *args: Situations())
    monkeypatch.setattr(engine, "ep", lambda *args: {"opt_choice": action - 1})
    return engine


@pytest.mark.parametrize("possession", [1, -1])
@pytest.mark.parametrize("coach", ["PHI", "AI"])
def test_down_six_with_five_seconds_requires_touchdown(monkeypatch, possession, coach):
    engine = engine_with_policy(monkeypatch, 3)
    assert engine.choose(situation(possession=possession, coach=coach), random.Random(1)) == 2


@pytest.mark.parametrize("coach", ["PHI", "AI"])
@pytest.mark.parametrize("seconds", [119, 45])
def test_fourth_and_four_needing_score_never_punts(monkeypatch, coach, seconds):
    engine = engine_with_policy(monkeypatch, 4)
    assert engine.choose(situation(seconds=seconds, coach=coach), random.Random(1)) in (1, 2)


@pytest.mark.parametrize("deficit", [1, 2, 3])
def test_last_second_field_goal_can_tie_or_win(monkeypatch, deficit):
    engine = engine_with_policy(monkeypatch, 4)
    assert engine.choose(situation(deficit=deficit), random.Random(1)) == 3


def test_halftime_and_ordinary_punts_unchanged(monkeypatch):
    engine = engine_with_policy(monkeypatch, 4)
    assert engine.choose(situation(period=2), random.Random(1)) == 3
    assert engine.choose(situation(seconds=300), random.Random(1)) == 4


def test_neural_policy_cannot_override_must_score(monkeypatch):
    engine = engine_with_policy(monkeypatch, 1)
    engine.predictor = lambda *args: 4
    assert engine.choose(situation(seconds=90, coach="AI"), random.Random(1)) == 2


def test_overtime_reply_requires_sufficient_score(monkeypatch):
    engine = engine_with_policy(monkeypatch, 3)
    assert engine.choose(situation(period=5, seconds=500, deficit=7), random.Random(1)) == 2
    assert engine.choose(situation(period=5, seconds=500, deficit=3), random.Random(1)) == 3


def test_two_score_deficit_allows_early_field_goal_but_not_final_seconds(monkeypatch):
    engine = engine_with_policy(monkeypatch, 3)
    assert engine.choose(situation(seconds=90, deficit=10), random.Random(1)) == 3
    assert engine.choose(situation(seconds=5, deficit=10), random.Random(1)) == 2
