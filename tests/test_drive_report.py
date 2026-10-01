import random

import pytest

from nflsim.drive_report import DriveReport
from nflsim.engine import Engine
from nflsim.models import SimulationRequest
from test_engine import state


def test_touchdown_conversion_stays_in_same_drive(repo, monkeypatch):
    engine = Engine(repo)
    monkeypatch.setattr(engine, "sample", lambda *args: 17)
    before = state(loc=7, target=0, distance=7, time=2)
    report = DriveReport()
    touchdown, _ = engine.advance(before, 1, random.Random(1))
    report.observe(before, touchdown)
    assert not report.drives
    converted, _ = engine.advance(touchdown, -2, random.Random(1))
    report.observe(touchdown, converted)
    drives = report.finish()
    assert len(drives) == 1
    assert drives[0]["plays"] == 1 and drives[0]["home_score"] == 7
    assert "Run for 7 yards." in drives[0]["outcome"]
    assert "XP made" in drives[0]["outcome"]
    assert len(drives[0]["events"]) == 2
    assert drives[0]["end_yards_to_goal"] == 0
    assert drives[0]["result"] == "TD"


def test_turnover_splits_drives_and_final_drive_is_retained():
    report = DriveReport()
    before = state()
    after = before.model_copy(
        update={"possession": -1, "plays_elapsed": 1, "message": "Turnover on downs."}
    )
    report.observe(before, after)
    assert len(report.drives) == 1 and report.drives[0]["team"] == "PHI"
    end = after.model_copy(update={"time": 0, "plays_elapsed": 2, "message": "Run for 3 yards."})
    report.observe(after, end)
    assert [d["team"] for d in report.finish()] == ["PHI", "KC"]
    assert sum(d["plays"] for d in report.drives) == 2


def test_recording_does_not_change_simulation(repo):
    engine = Engine(repo)
    request = SimulationRequest(
        team1="PHI", team2="KC", year1=2030, year2=2030, num_plays=5, timing_mode="plays", seed=25
    )
    plain = engine.simulate(request)
    detailed = engine.simulate(request.model_copy(update={"include_drives": True}))
    assert detailed["drives"][0]
    assert sum(d["plays"] for d in detailed["drives"][0]) == detailed["play_counts"][0]
    assert {k: v for k, v in plain.items() if k != "drives"} == {
        k: v for k, v in detailed.items() if k != "drives"
    }


def test_punt_tracks_kick_spot_and_receiving_possession_separately():
    report = DriveReport()
    before = state(loc=60, target=50)
    after = before.model_copy(
        update={"possession": -1, "loc": 80, "plays_elapsed": 1, "message": "Punt for 40 yards."}
    )
    report.observe(before, after)
    drive = report.finish()[0]
    assert drive["start_yards_to_goal"] == 60  # Own 40.
    assert drive["end_yards_to_goal"] == 60  # Punt from own 40.
    assert drive["kick_end_yards_to_goal"] == 20  # Opponent takes possession on own 20.
    assert drive["result"] == "Punt"


@pytest.mark.parametrize("message", ["Field goal is GOOD!", "Field goal MISSED!"])
def test_field_goal_marker_uses_kick_spot(message):
    report = DriveReport()
    before = state(loc=30, target=20)
    after = before.model_copy(
        update={"possession": -1, "loc": 63, "plays_elapsed": 1, "message": message, "drive": False}
    )
    report.observe(before, after)
    drive = report.finish()[0]
    assert drive["end_yards_to_goal"] == 30
    assert drive["result"] == ("FG made" if "GOOD" in message else "FG missed")
