import argparse
import json
import shutil
from pathlib import Path
import httpx
from contextlib import contextmanager

from .config import Settings, TEAMS
from .engine import Engine
from .models import SimulationRequest
from .pipeline import build, compile_cpp, dataset_records, import_season, upgrade_special_teams
from .storage import repository, ScheduleRepository
from .schedule import fetch_schedule, simulate_season, write_results


@contextmanager
def data_lock(settings):
    import fcntl

    settings.data_dir.mkdir(parents=True, exist_ok=True)
    with (settings.data_dir / ".build.lock").open("w") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise RuntimeError("Another data command is running") from exc
        yield


def publish(settings, season):
    """Explicit opt-in cloud publication, never part of build or startup."""
    from .storage import SupabaseRepository

    manifest, tables = dataset_records(season)
    adapter = SupabaseRepository(settings)
    try:
        adapter.publish(manifest, tables)
    finally:
        adapter.close()
    print(f"Published {manifest['year']} to Supabase")


def parser():
    cli = argparse.ArgumentParser(description="4th & Sim development and data commands")
    commands = cli.add_subparsers(dest="command", required=True)
    commands.add_parser("compile", help="Compile the C++ EP solvers")
    serve = commands.add_parser("serve", help="Start the API")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument("--reload", action="store_true")
    data = commands.add_parser("data", help="Generate, validate, and publish season data")
    actions = data.add_subparsers(dest="action", required=True)
    for name in ("build", "rebuild", "validate", "import", "publish", "special-teams"):
        action = actions.add_parser(name)
        action.add_argument("--season", type=int, required=True)
        if name in ("build", "rebuild"):
            action.add_argument("--teams", nargs="+", default=list(TEAMS))
            action.add_argument("--threshold", type=int, default=20)
            action.add_argument("--iterations", type=int, default=3)
            action.add_argument("--seed", type=int, default=25)
            action.add_argument(
                "--refresh", action="store_true", help="Download a fresh raw season snapshot"
            )
    actions.add_parser("list")
    for name in ("simulate", "play", "train"):
        action = commands.add_parser(name)
        action.add_argument("--season", type=int, required=True)
        action.add_argument("--team1", default="PHI")
        action.add_argument("--team2", default="KC")
        action.add_argument("--plays", type=int, default=150, help="Play budget in plays mode only")
        action.add_argument("--timing-mode", choices=("clock", "plays"), default="clock")
        action.add_argument("--seed", type=int, default=25)
        if name == "play":
            action.add_argument(
                "--mode",
                type=int,
                choices=range(5),
                default=1,
                help="0: human/human, 1: human/CPU, 2: CPU/CPU, "
                "3: CPU/CPU without pauses, 4: AI/CPU",
            )
        if name == "simulate":
            action.add_argument("--games", type=int, default=100)
        if name == "train":
            action.add_argument("--episodes", type=int, default=10000)
    schedule = commands.add_parser("schedule", help="Fetch or inspect an actual NFL schedule")
    schedule_actions = schedule.add_subparsers(dest="action", required=True)
    for name in ("fetch", "list"):
        action = schedule_actions.add_parser(name)
        action.add_argument("--season", type=int, required=True)
        if name == "fetch":
            action.add_argument("--refresh", action="store_true")
        else:
            action.add_argument("--team")
    season = commands.add_parser("season", help="Simulate an explicitly fetched regular season")
    season_actions = season.add_subparsers(dest="action", required=True)
    action = season_actions.add_parser("simulate")
    action.add_argument("--season", type=int, required=True)
    action.add_argument("--seed", type=int, default=25)
    action.add_argument("--team")
    action.add_argument("--week", type=int, choices=range(1, 19))
    action.add_argument("--output", type=Path)
    action.add_argument("--playoffs", action="store_true", help="Continue through the Super Bowl")
    return cli


def main():
    args = parser().parse_args()
    settings = Settings.from_env()
    try:
        if args.command == "compile":
            compile_cpp(settings.data_dir)
        elif args.command == "serve":
            import uvicorn

            uvicorn.run("nflsim.api:app", host=args.host, port=args.port, reload=args.reload)
        elif args.command == "data":
            if args.action == "list":
                print(json.dumps(repository(settings).seasons(), indent=2))
                return
            season = settings.data_dir / "seasons" / str(args.season)
            with data_lock(settings):
                if args.action in ("build", "rebuild"):
                    backup = season.with_name(season.name + ".previous")
                    if args.action == "rebuild" and season.exists():
                        if backup.exists():
                            raise ValueError(
                                f"Recover previous build at {backup} before rebuilding"
                            )
                        season.rename(backup)
                    try:
                        build(
                            settings,
                            args.season,
                            args.teams,
                            args.threshold,
                            args.iterations,
                            args.seed,
                            args.refresh,
                        )
                    except Exception:
                        if backup.exists():
                            if season.exists():
                                shutil.rmtree(season)
                            backup.rename(season)
                        raise
                    if backup.exists():
                        shutil.rmtree(backup)
                elif args.action == "special-teams":
                    upgrade_special_teams(settings, args.season)
                elif args.action == "validate":
                    manifest, _ = dataset_records(season)
                    for name, expected in manifest["artifacts"].items():
                        import hashlib

                        actual = hashlib.sha256((season / name).read_bytes()).hexdigest()
                        if actual != expected:
                            raise ValueError(f"Artifact checksum mismatch: {name}")
                    print(f"Season {args.season} validated")
                elif args.action == "import":
                    import_season(settings, season)
                    print(f"Season {args.season} imported")
                elif args.action == "publish":
                    publish(settings, season)
        elif args.command == "schedule":
            store = ScheduleRepository(settings.data_dir / "schedules")
            if args.action == "fetch":
                games = fetch_schedule(store, args.season, args.refresh)
                print(f"Cached {len(games)} regular-season games for {args.season}")
            else:
                from .config import normalize_team

                games = store.rows("schedule", year=args.season)
                if not games:
                    raise ValueError("Fetch this season's schedule first")
                team = normalize_team(args.team) if args.team else None
                print(
                    json.dumps(
                        [g for g in games if not team or team in (g["home_team"], g["away_team"])],
                        indent=2,
                    )
                )
        elif args.command == "season":

            def progress(index, total, game):
                print(
                    f"[{index}/{total}] {game.get('game_type', 'REG')} {game.get('week', '')}: "
                    f"{game['away_team']} {game['away_score']} at "
                    f"{game['home_team']} {game['home_score']}",
                    flush=True,
                )

            result = simulate_season(
                Engine(repository(settings)),
                ScheduleRepository(settings.data_dir / "schedules"),
                args.season,
                args.seed,
                args.team,
                args.week,
                progress=progress,
                playoffs=args.playoffs,
            )
            if args.output:
                write_results(args.output, result)
            print(json.dumps(result["standings"], indent=2))
            if args.playoffs:
                print("Playoff seeds:", json.dumps(result["playoffs"]["seeds"], indent=2))
                print("Super Bowl champion:", result["playoffs"]["champion"])
            count = len(result["games"]) + len(result.get("playoffs", {}).get("games", []))
            print(f"Completed {count} simulated games.")
            if args.output:
                print(f"Saved results to {args.output}")
        elif args.command == "simulate":
            engine = Engine(repository(settings))
            request = SimulationRequest(
                team1=args.team1,
                team2=args.team2,
                year1=args.season,
                year2=args.season,
                num_games=args.games,
                num_plays=args.plays,
                seed=args.seed,
                timing_mode=args.timing_mode,
            )
            print(json.dumps(engine.simulate(request), indent=2))
        elif args.command == "play":
            from .prediction import Predictor

            engine = Engine(repository(settings), Predictor(settings.model_path))
            from .console import play

            play(engine, args)
        elif args.command == "train":
            from .training import train

            train(settings, args)
    except (ValueError, RuntimeError, OSError, httpx.HTTPError) as exc:
        raise SystemExit(str(exc)) from exc


if __name__ == "__main__":
    main()
