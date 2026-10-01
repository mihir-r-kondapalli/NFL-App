import random
from copy import deepcopy

import pytest

from conftest import MemoryRepository
from nflsim.clock import display_clock
from nflsim.engine import Engine
from nflsim.matchup import matchup_pdf
from nflsim.models import GameState, SimulationRequest
from nflsim.profiles import validate_profile
from nflsim.storage import LocalRepository


def profile(xp=1.0, fg=1.0, punt=40, kickoff=65):
    return dict(
        xp_prob=xp,
        fg_probs=[fg] * 99,
        kickoffs=[dict(loc=kickoff, td=kickoff == 0, touchback=kickoff != 0, weight=1.0)],
        punts={
            str(yl): dict(values=[min(punt, yl) if abs(punt) < 1000 else punt], weights=[1.0])
            for yl in range(1, 100)
        },
        out_of_bounds_prob=0.0,
        zero_pass_incomplete_prob=1.0,
    )


@pytest.fixture
def engine(monkeypatch):
    repo = MemoryRepository()
    repo.records["special_teams"] = [
        dict(year=2030, yardline=yl, kick_prob=1.0, punt_values=[min(40, yl)])
        for yl in range(1, 100)
    ]
    repo.records["team_profiles"] = [
        dict(year=2030, team=t, profile_json=profile()) for t in ("PHI", "KC")
    ]
    engine = Engine(repo)
    monkeypatch.setattr(engine, "sample", lambda *args: 3)
    monkeypatch.setattr(engine, "choose", lambda *args: 1)
    return engine


def clock_state(**overrides):
    fields = dict(
        team1="PHI",
        team2="KC",
        year1=2030,
        year2=2030,
        coach1="PHI",
        coach2="KC",
        timing_mode="clock",
        time=3600,
        opening_receiver=1,
        drive=True,
        loc=40,
        target=30,
        down=1,
        distance=10,
    )
    fields.update(overrides)
    return GameState(**fields)


def checked(state):
    # Returned states must survive the stateless browser's next request validation.
    return GameState.model_validate(state.model_dump())


def test_clock_uses_seconds_and_presnap_runoff(engine):
    first, _ = engine.advance(clock_state(), 1, random.Random(1))
    assert 3592 <= first.time <= 3596
    second, _ = engine.advance(checked(first), 1, random.Random(1))
    assert 29 <= first.time - second.time <= 48
    assert second.plays_elapsed == 2
    assert display_clock(second).startswith("Q1 14:")


def test_quarter_carries_drive_halftime_resets_receiver_and_timeouts(engine):
    q2, _ = engine.advance(clock_state(time=2701), 1, random.Random(1))
    assert (q2.period, q2.time, q2.drive, q2.loc) == (2, 2700, True, 37)
    checked(q2)
    q3, status = engine.advance(
        clock_state(time=1801, period=2, possession=1, timeouts1=0, timeouts2=1), 1
    )
    assert (q3.period, q3.time, q3.possession, q3.drive, status) == (3, 1800, -1, False, -1)
    assert q3.timeouts1 == q3.timeouts2 == 3
    checked(q3)


def test_final_touchdown_conversion_before_overtime(engine):
    td, status = engine.advance(
        clock_state(time=1, period=4, score2=7, loc=3, target=0, distance=3), 1
    )
    assert td.pending_xp and td.time == 0 and status == 2
    after, status = engine.advance(checked(td), -2, random.Random(1))
    assert (after.score1, after.score2, after.period, after.time, status) == (7, 7, 5, 600, -1)
    assert after.timeouts1 == after.timeouts2 == 2
    checked(after)


def test_timeout_stops_clock_without_consuming_play(engine):
    after, status = engine.advance(clock_state(clock_running=True), 5)
    assert (after.time, after.timeouts1, after.clock_running, after.plays_elapsed, status) == (
        3600,
        2,
        False,
        0,
        1,
    )
    with pytest.raises(ValueError, match="No timeouts"):
        engine.advance(clock_state(timeouts1=0), 5)


def test_kneel_and_expiring_presnap_end_game(engine):
    after, _ = engine.advance(
        clock_state(time=25, period=4, clock_running=True, score1=7, timeouts2=0),
        6,
        random.Random(1),
    )
    assert after.finished and after.time == 0 and after.plays_elapsed == 0
    after, _ = engine.advance(clock_state(), 6)
    assert after.loc == 41 and after.down == 2 and "Kneel" in after.message


def test_incompletion_and_two_minute_warning_stop_clock(engine, monkeypatch):
    monkeypatch.setattr(engine, "sample", lambda *args: 0)
    after, _ = engine.advance(clock_state(), 2, random.Random(1))
    assert not after.clock_running
    after, _ = engine.advance(clock_state(time=121, period=4), 1, random.Random(1))
    assert not after.clock_running and after.time < 120


def test_ot_opening_field_goal_does_not_end_game(engine):
    after, _ = engine.advance(clock_state(time=600, period=5, down=4), 3, random.Random(1))
    assert after.score1 == 3 and after.ot_completed == 1 and not after.finished
    second = checked(after).model_copy(
        update=dict(drive=True, loc=40, target=30, distance=10, down=4)
    )
    tied, _ = engine.advance(second, 3, random.Random(1))
    assert tied.score1 == tied.score2 == 3 and tied.ot_completed == 3 and not tied.finished
    third = checked(tied).model_copy(
        update=dict(drive=True, loc=40, target=30, distance=10, down=4)
    )
    won, status = engine.advance(third, 3, random.Random(1))
    assert won.finished and won.score1 == 6 and status == 0
    checked(won)


def test_ot_both_possessions_and_clock_cap(engine):
    td, _ = engine.advance(clock_state(time=600, period=5, loc=3, target=0, distance=3), 1)
    xp, _ = engine.advance(checked(td), -2, random.Random(1))
    assert xp.score1 == 7 and xp.ot_completed == 1 and not xp.finished
    other = checked(xp).model_copy(update=dict(drive=True, loc=40, target=30, distance=10, down=4))
    lost, _ = engine.advance(other, 4, random.Random(1))
    assert lost.finished and lost.score1 == 7 and lost.score2 == 0
    expiry, _ = engine.advance(clock_state(time=1, period=5), 1)
    assert expiry.finished and expiry.score1 == expiry.score2 == 0


def test_ot_defensive_touchdown_finishes_without_xp(engine, monkeypatch):
    monkeypatch.setattr(engine, "sample", lambda *args: -2130)
    after, status = engine.advance(clock_state(period=5, time=600, loc=80, target=70), 2)
    assert after.finished and not after.pending_xp and after.score2 == 6 and status == 0


def test_team_profiles_control_fg_xp_kickoff_and_punts(engine):
    engine.repo.records["team_profiles"][0]["profile_json"] = profile(
        xp=0.0, fg=0.0, punt=1110, kickoff=72
    )
    failed, _ = engine.advance(clock_state(down=4), 3, random.Random(1))
    assert failed.score1 == 0 and failed.possession == -1 and failed.drive
    td, _ = engine.advance(clock_state(loc=3, target=0, distance=3), 1)
    xp, _ = engine.advance(td, -2, random.Random(1))
    assert xp.score1 == 6
    received, _ = engine.advance(xp, -1, random.Random(1))
    assert received.loc == 72  # PHI's kickoff profile, not receiving KC's.
    muff, _ = engine.advance(clock_state(down=4), 4, random.Random(1))
    assert muff.possession == 1 and muff.loc == 30 and "muffed" in muff.message


def test_seeded_full_clock_games_end_and_validate(engine, monkeypatch):
    advance = engine.advance

    def roundtrip(*args, **kwargs):
        state, status = advance(*args, **kwargs)
        checked(state)
        return state, status

    monkeypatch.setattr(engine, "advance", roundtrip)
    request = SimulationRequest(team1="PHI", team2="KC", year1=2030, year2=2030, seed=7)
    result = engine.simulate(request)
    assert engine.simulate(request) == result
    assert result["timing_mode"] == "clock" and result["play_counts"][0] > 50


def test_matchup_neutrality_symmetry_and_defensive_effect():
    league = {0: 0.5, 10: 0.5}
    attack = {0: 0.2, 10: 0.8}
    stingy = {0: 0.8, 10: 0.2}
    neutral = matchup_pdf(league, league, league, league)
    assert neutral == pytest.approx(league)
    strong = matchup_pdf(attack, league, league, league)
    assert strong[10] > neutral[10]
    assert matchup_pdf(attack, stingy, league, league)[10] < strong[10]
    assert matchup_pdf(attack, stingy, league, league) == matchup_pdf(
        stingy, attack, league, league
    )
    rare = matchup_pdf({-2100: 1.0}, {20: 1.0}, {0: 1.0}, {0: 1.0})
    assert all(p > 0 for p in rare.values()) and sum(rare.values()) == pytest.approx(1)


def test_profile_validation_rejects_corrupt_weights():
    valid = profile()
    validate_profile(valid)
    bad = deepcopy(valid)
    bad["punts"]["40"]["weights"] = [float("nan")]
    with pytest.raises(ValueError, match="probability"):
        validate_profile(bad)


def test_local_profile_roundtrip_and_old_database_fallback(tmp_path):
    import sqlite3

    repo = LocalRepository(tmp_path / "data.sqlite3")
    repo.publish(
        dict(year=2030, teams=["PHI"]),
        {"team_profiles": [dict(year=2030, team="PHI", profile_json=profile())]},
    )
    assert repo.rows("team_profiles", year=2030, team="PHI")[0]["profile_json"] == profile()
    with sqlite3.connect(repo.path) as conn:
        conn.execute("DROP TABLE team_profiles")
    assert repo.rows("team_profiles", year=2030, team="PHI") == []


@pytest.mark.parametrize("year", [2022, 2030])
def test_postseason_opening_touchdown_allows_reply(engine, monkeypatch, year):
    monkeypatch.setattr(engine, "validate_matchup", lambda state: None)
    state = clock_state(year1=year, year2=year, postseason=True, period=5, time=900, loc=3, target=0,
                        distance=3, ot_completed=0)
    scored, _ = engine.advance(state, 1, random.Random(1))
    assert scored.pending_xp and not scored.finished
    converted, _ = engine.advance(scored, -2, random.Random(1))
    assert not converted.finished and converted.ot_completed == 1
    checked(converted)
