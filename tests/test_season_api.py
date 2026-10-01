from fastapi.testclient import TestClient

from conftest import MemoryRepository
from nflsim.api import create_app
from nflsim.config import Settings
from nflsim.storage import ScheduleRepository
from test_playoffs import PlayoffEngine
from test_schedule import synthetic_games


class InlineExecutor:
    def __init__(self, **kwargs):
        pass

    def submit(self, operation, *args):
        operation(*args)

    def shutdown(self, **kwargs):
        pass


def test_explicit_job_keeps_results_in_memory_and_reports_progress(tmp_path, monkeypatch):
    monkeypatch.setattr("nflsim.season_jobs.ThreadPoolExecutor", InlineExecutor)
    engine = PlayoffEngine()
    monkeypatch.setattr("nflsim.season_jobs.Engine", lambda repo: engine)
    ScheduleRepository(tmp_path / "schedules").save(2030, synthetic_games(), "fixture", "fixture")
    with TestClient(create_app(Settings(tmp_path), MemoryRepository())) as client:
        assert client.get("/season/results?season=2030").json() == []
        assert not engine.calls
        assert client.post("/season/simulate", json={"seed": 25}).status_code == 422
        response = client.post(
            "/season/simulate", json={"season": 2030, "seed": 25, "playoffs": True}
        )
        assert response.status_code == 202
        job = client.get("/season/jobs/" + response.json()["id"]).json()
        assert job["status"] == "complete" and job["completed"] == job["total"] == 285
        assert client.get("/season/results?season=2030").json() == []
        assert "filename" not in job
        result = job["result"]
        assert len(result["games"]) == 272 and len(result["playoffs"]["games"]) == 13
        assert not (tmp_path / "results").exists()
        assert len(engine.calls) == 285  # Reading results does not simulate anything.
        assert client.get("/season/jobs/missing").status_code == 404


def test_missing_schedule_and_invalid_saved_result(tmp_path):
    with TestClient(create_app(Settings(tmp_path), MemoryRepository())) as client:
        response = client.post("/season/simulate", json={"season": 2030})
        assert response.status_code == 400 and "schedule" in response.json()["detail"]
        folder = tmp_path / "results"
        folder.mkdir()
        (folder / "2030_bad.json").write_text("not JSON")
        (folder / "2030_link.json").symlink_to(folder / "2030_bad.json")
        assert client.get("/season/results?season=2030").json() == []
        assert client.get("/season/results/2030_bad.json").status_code == 400
        assert client.get("/season/results/2030_link.json").status_code == 404
        assert client.get("/season/results/credentials.json").status_code == 400


def test_job_failure_visible_and_concurrency_bounded(tmp_path, monkeypatch):
    from nflsim.season_jobs import SeasonJobs

    monkeypatch.setattr("nflsim.season_jobs.ThreadPoolExecutor", InlineExecutor)
    engine = PlayoffEngine()
    monkeypatch.setattr("nflsim.season_jobs.Engine", lambda repo: engine)
    ScheduleRepository(tmp_path / "schedules").save(2030, synthetic_games(), "fixture", "fixture")
    jobs = SeasonJobs(Settings(tmp_path), MemoryRepository())

    def fail(request):
        raise RuntimeError("Synthetic failure")

    engine.simulate = fail
    job = jobs.start(2030, 25, False)
    assert job["status"] == "failed" and job["error"] == "Synthetic failure"
    assert not (tmp_path / "results").exists()
    jobs.jobs["active"] = {"status": "running"}
    import pytest

    with pytest.raises(ValueError, match="already running"):
        jobs.start(2030, 25, False)
    jobs.close()


def test_schedule_download_requires_explicit_post(tmp_path, monkeypatch):
    calls = []

    def fetch(store, season):
        calls.append(season)
        return synthetic_games(season)

    monkeypatch.setattr("nflsim.api.fetch_schedule", fetch)
    with TestClient(create_app(Settings(tmp_path), MemoryRepository())) as client:
        client.get("/season/results?season=2030")
        assert calls == []
        response = client.post("/season/schedule", json={"season": 2030})
        assert response.status_code == 200 and response.json() == {"games": 272}
        assert calls == [2030]
        assert client.post("/season/schedule", json={}).status_code == 422
