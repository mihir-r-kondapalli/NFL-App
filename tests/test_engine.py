import random

import pytest

from nflsim.engine import Engine, pdf
from nflsim.models import GameState, SimulationRequest
from nflsim.storage import DataUnavailable


def state(**overrides):
    fields = dict(
        team1="PHI",
        team2="KC",
        year1=2030,
        year2=2030,
        coach1="PHI",
        coach2="KC",
        loc=40,
        target=30,
        down=1,
        distance=10,
        time=10,
        drive=True,
    )
    fields.update(overrides)
    return GameState(**fields)


def test_first_down_and_turnover_on_downs(repo):
    engine = Engine(repo)
    updated, status = engine.advance(state(loc=33, target=30, distance=3), 1)
    assert (updated.down, updated.loc, updated.distance, status) == (1, 30, 10, 1)
    updated, _ = engine.advance(state(down=4), 1)
    assert (updated.possession, updated.loc, updated.down, updated.time) == (-1, 63, 1, 9)


def test_touchdown_final_play_allows_extra_point(repo):
    engine = Engine(repo)
    updated, status = engine.advance(state(loc=3, target=0, distance=3, time=1), 1)
    assert (updated.score1, updated.time, updated.pending_xp, status) == (6, 0, True, 2)
    updated, status = engine.advance(updated, -2, random.Random(1))
    assert (updated.score1, updated.score2, updated.pending_xp, status) == (7, 0, False, 0)


def test_made_field_goal_switches_once(repo):
    engine = Engine(repo)
    updated, status = engine.advance(state(down=4), 3)
    assert (updated.score1, updated.score2, updated.possession, updated.drive, status) == (
        3,
        0,
        -1,
        False,
        -1,
    )


def test_safety_and_kickoff(repo, monkeypatch):
    engine = Engine(repo)
    monkeypatch.setattr(engine, "sample", lambda *args: -5)
    updated, status = engine.advance(state(loc=98, target=88), 1)
    assert (updated.score1, updated.score2, updated.possession, status) == (0, 2, -1, -1)
    updated, status = engine.advance(updated, -1, random.Random(1))
    assert updated.drive and 66 <= updated.loc <= 75 and status == 1


@pytest.mark.parametrize(
    "gain,loc,expected_pos,expected_score,expected_loc",
    [
        (-2105, 5, -1, 0, 90),
        (-2130, 80, -1, 6, 0),
        (-2000, 80, -1, 0, 80),
        (-1130, 80, -1, 6, 0),
    ],
)
def test_turnover_return_encoding(
    repo, monkeypatch, gain, loc, expected_pos, expected_score, expected_loc
):
    engine = Engine(repo)
    monkeypatch.setattr(engine, "sample", lambda *args: gain)
    updated, _ = engine.advance(state(loc=loc, target=max(0, loc - 10), distance=min(10, loc)), 2)
    assert (updated.possession, updated.score2, updated.loc) == (
        expected_pos,
        expected_score,
        expected_loc,
    )


def test_punt_touchback(repo):
    engine = Engine(repo)
    updated, _ = engine.advance(state(loc=20, target=10), 4)
    assert (updated.possession, updated.loc, updated.distance) == (-1, 80, 10)


def test_illegal_extra_point_and_human_continue(repo):
    engine = Engine(repo)
    with pytest.raises(ValueError, match="Extra points"):
        engine.advance(state(), -2)
    with pytest.raises(ValueError, match="human-controlled"):
        engine.advance(state(coach1="Human"), -1)


def test_seeded_synthetic_batch_reproducible(repo):
    request = SimulationRequest(
        team1="PHI", team2="KC", year1=2030, year2=2030, num_games=2, num_plays=4, seed=7
    )
    engine = Engine(repo)
    assert engine.simulate(request) == engine.simulate(request)


def test_malformed_cdf_fails_instead_of_inventing_gain():
    with pytest.raises(DataUnavailable):
        pdf({"values_json": [], "cdf_json": []})
    with pytest.raises(DataUnavailable):
        pdf({"values_json": [1, 2], "cdf_json": [0.8, 0.4]})


@pytest.mark.parametrize("choice,label", [(1, "Run"), (2, "Pass")])
def test_touchdown_message_uses_distance_to_goal(repo, monkeypatch, choice, label):
    engine = Engine(repo)
    monkeypatch.setattr(engine, "sample", lambda *args: 17)
    updated, _ = engine.advance(state(loc=7, target=0, distance=7), choice)
    assert updated.score1 == 6 and updated.pending_xp
    assert f"{label} for 7 yards." in updated.message
    assert "17 yards" not in updated.message


@pytest.mark.parametrize("coach", ["Human", "PHI"])
def test_interactive_conversion_only_automatic_for_bot(repo, monkeypatch, coach):
    engine = Engine(repo)
    monkeypatch.setattr(engine, "sample", lambda *args: 13)
    updated, status = engine.advance_interactive(
        state(loc=3, target=0, distance=3, coach1=coach, time=1), 1, random.Random(1)
    )
    assert "Run for 3 yards." in updated.message
    if coach == "Human":
        assert updated.pending_xp and status == 2 and updated.score1 == 6
    else:
        assert not updated.pending_xp and status == 0 and updated.score1 == 7
        assert "XP made!" in updated.message


def test_bot_chooses_two_points_to_tie_late(repo, monkeypatch):
    engine = Engine(repo)
    monkeypatch.setattr(engine, "sample", lambda *args: 13)
    updated, _ = engine.advance_interactive(
        state(loc=3, target=0, distance=3, score2=8, time=1), 1, random.Random(1)
    )
    assert (updated.score1, updated.score2) == (8, 8)
    assert "2PT conversion made!" in updated.message
    assert not updated.pending_xp
