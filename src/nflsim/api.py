from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import random
import json
import re

from .season_jobs import SeasonJobs
from .schedule import fetch_schedule
from .storage import ScheduleRepository
from .models import SeasonSimulationRequest

from .analytics import decisions, expected_points, ranking_data
from .config import Settings
from .engine import Engine
from .models import AdvanceRequest, DataQuery, GameState, PredictionRequest, SimulationRequest
from .storage import DataUnavailable, repository


def create_app(settings=None, repo=None):
    settings = settings or Settings.from_env()
    repo = repo or repository(settings)

    jobs = SeasonJobs(settings, repo)

    @asynccontextmanager
    async def lifespan(_app):
        try:
            yield
        finally:
            jobs.close()
            close = getattr(repo, "close", None)
            if close:
                close()

    app = FastAPI(title="4th & Sim API", version="2.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    # The neural model is optional and loaded only when configured weights exist.
    from .prediction import Predictor

    predictor = Predictor(settings.model_path)
    engine = Engine(repo, predictor)
    revision = None

    def current_engine():
        nonlocal engine, revision
        current = settings.database.stat().st_mtime_ns if settings.database.exists() else None
        if current != revision:
            engine = Engine(repo, predictor)
            revision = current
        return engine

    def run(operation):
        try:
            return operation()
        except DataUnavailable as exc:
            raise HTTPException(404, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(503, "The configured data provider is unavailable") from exc

    @app.get("/health")
    @app.get("/")
    def health():
        return run(
            lambda: {
                "status": "healthy",
                "provider": settings.provider,
                "seasons": [s["year"] for s in repo.seasons()],
                "policy": "neural" if settings.model_path.exists() else "expected_points",
            }
        )

    @app.get("/metadata")
    def metadata():
        return run(lambda: {"seasons": repo.seasons(), "rankings": ranking_data(repo)})

    @app.post("/expected-points")
    def eps(query: DataQuery):
        return run(lambda: {"data": expected_points(repo, query), "error": None})

    @app.post("/decisions")
    def coach_decisions(query: DataQuery):
        return run(lambda: {"data": decisions(repo, query), "error": None})

    @app.post("/advance")
    def advance(request: AdvanceRequest):
        return run(
            lambda: current_engine().advance_interactive(
                request.state, request.choice, random.Random(request.seed)
            )
        )

    @app.post("/simulate")
    def simulate(request: SimulationRequest):
        return run(lambda: current_engine().simulate(request))

    @app.post("/season/schedule")
    def load_schedule(request: SeasonSimulationRequest):
        return run(
            lambda: {
                "games": len(
                    fetch_schedule(
                        ScheduleRepository(settings.data_dir / "schedules"), request.season
                    )
                )
            }
        )

    @app.post("/season/simulate", status_code=202)
    def start_season(request: SeasonSimulationRequest):
        return run(lambda: jobs.start(request.season, request.seed, request.playoffs))

    @app.get("/season/jobs/{job_id}")
    def season_job(job_id: str):
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(
                404, "Simulation expired or the server restarted. Start a new run."
            )
        return job

    @app.get("/season/results")
    def season_results(season: int):
        results = []
        for path in sorted(
            (settings.data_dir / "results").glob(f"{season}_*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        ):
            if path.is_symlink():
                continue
            try:
                data = json.loads(path.read_text())
                if (
                    isinstance(data, dict)
                    and data.get("season") == season
                    and data.get("complete")
                    and "standings" in data
                ):
                    results.append(
                        dict(
                            filename=path.name,
                            season=season,
                            seed=data["seed"],
                            playoffs="playoffs" in data,
                            games=len(data["games"]),
                        )
                    )
            except (OSError, ValueError, KeyError, TypeError):
                continue
        return results

    @app.get("/season/results/{filename}")
    def season_result(filename: str):
        if not re.fullmatch(r"[0-9]{4}_[A-Za-z0-9_-]+\.json", filename):
            raise HTTPException(400, "Invalid result filename")
        path = settings.data_dir / "results" / filename
        if not path.is_file() or path.is_symlink():
            raise HTTPException(404, "Saved result not found")
        try:
            return json.loads(path.read_text())
        except (OSError, ValueError) as exc:
            raise HTTPException(400, "Could not read saved result") from exc

    @app.post("/predict")
    def predict(request: PredictionRequest):

        state = GameState(
            team1=request.team,
            team2=request.team,
            year1=request.year,
            year2=request.year,
            coach1="AI",
            down=request.down,
            loc=request.loc,
            distance=request.distance,
            target=request.loc - request.distance,
            time=request.time,
            timing_mode=request.timing_mode,
            period=max(1, min(4, 5 - (request.time + 899) // 900)),
            drive=True,
            score1=max(0, request.score_diff),
            score2=max(0, -request.score_diff),
        )
        return run(lambda: {"action": current_engine().choose(state, random.Random(request.seed))})

    return app


app = create_app()
