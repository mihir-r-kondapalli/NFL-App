"""Bounded, process-local season jobs; never start work until explicitly requested."""

from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from uuid import uuid4

from .engine import Engine
from .models import GameState
from .schedule import simulate_season, validate_games
from .storage import ScheduleRepository


class SeasonJobs:
    def __init__(self, settings, repo):
        self.settings, self.repo = settings, repo
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="season")
        self.lock = Lock()
        self.jobs = {}

    def start(self, season, seed, playoffs):
        store = ScheduleRepository(self.settings.data_dir / "schedules")
        games = store.rows("schedule", year=season)
        validate_games(games, season)
        engine = Engine(self.repo)
        for game in games:
            engine.validate_matchup(
                GameState(
                    team1=game["home_team"], team2=game["away_team"], year1=season, year2=season
                )
            )
        with self.lock:
            if any(j["status"] == "running" for j in self.jobs.values()):
                raise ValueError("A season simulation is already running. Wait for it to finish.")
            while len(self.jobs) >= 8:
                del self.jobs[next(iter(self.jobs))]
            job_id = uuid4().hex
            self.jobs[job_id] = dict(
                id=job_id,
                status="running",
                season=season,
                seed=seed,
                completed=0,
                total=len(games) + ((13 if season >= 2020 else 11) if playoffs else 0),
                last_game=None,
            )
        self.executor.submit(self._run, job_id, engine, store, season, seed, playoffs)
        return self.get(job_id)

    def _run(self, job_id, engine, store, season, seed, playoffs):
        def progress(index, total, game):
            with self.lock:
                self.jobs[job_id]["completed"] += 1
                self.jobs[job_id]["last_game"] = game

        try:
            result = simulate_season(
                engine, store, season, seed, progress=progress, playoffs=playoffs
            )
            with self.lock:
                self.jobs[job_id].update(status="complete", result=result)
        except Exception as exc:
            with self.lock:
                self.jobs[job_id].update(status="failed", error=str(exc))

    def get(self, job_id):
        with self.lock:
            return dict(self.jobs[job_id]) if job_id in self.jobs else None

    def close(self):
        self.executor.shutdown(wait=True)
