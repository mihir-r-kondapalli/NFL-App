"""Build isolated season artifacts, validate them, then publish one SQLite transaction."""

import csv
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

from .config import ROOT, normalize_team
from .engine import pdf
from .profiles import validate_profile
from .storage import DataUnavailable


def read_csv(path):
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def run(command, cwd, env, log):
    print("Running:", " ".join(str(v) for v in command), flush=True)
    with log.open("a") as handle:
        try:
            subprocess.run(
                [str(v) for v in command],
                cwd=cwd,
                env=env,
                stdout=handle,
                stderr=subprocess.STDOUT,
                check=True,
            )
        except subprocess.CalledProcessError as exc:
            lines = log.read_text(errors="replace").splitlines()
            raise RuntimeError(f"Command failed; see {log}\n" + "\n".join(lines[-20:])) from exc


def compile_cpp(data_dir):
    compiler = shutil.which("c++")
    if not compiler:
        raise RuntimeError("Install a C++17 compiler (macOS: xcode-select --install)")
    target = data_dir / "bin"
    target.mkdir(parents=True, exist_ok=True)
    for name in ("simulator_norm", "simulator_naive_norm"):
        source = ROOT / "pipeline/cpp" / (name + ".cpp")
        binary = target / name
        header = source.with_name("json.hpp")
        if not binary.exists() or binary.stat().st_mtime < max(
            source.stat().st_mtime, header.stat().st_mtime
        ):
            subprocess.run(
                [compiler, "-std=c++17", "-O2", str(source), "-o", str(binary)], check=True
            )
    return target


def canonical_csv(path):
    rows = read_csv(path)
    if not rows:
        raise ValueError(f"Empty generated CSV: {path}")
    fields = list(rows[0])
    keys = (
        ("Down", "Distance", "Yardline") if "Down" in fields else ("down", "distance", "yardline")
    )
    rows.sort(key=lambda r: tuple(int(r[k]) for k in keys))
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def dataset_records(season):
    """Normalize artifacts once; both SQLite and Supabase consume these same tables."""
    manifest = json.loads((season / "manifest.json").read_text())
    year = manifest["year"]
    if not isinstance(year, int) or not 1999 <= year <= 2100:
        raise ValueError("Invalid season in manifest")
    if season.name.isdigit() and int(season.name) != year:
        raise ValueError("Season argument and artifact manifest do not match")
    if manifest.get("schema_version", 1) != 1:
        raise ValueError("Unsupported artifact schema")
    records = {
        t: []
        for t in (
            "expected_points",
            "coach_decision_probs",
            "play_cdf",
            "special_teams",
            "team_profiles",
            "rankings",
        )
    }
    for team in manifest["teams"]:
        directory = season / "teams" / team
        for defense in (False, True):
            ep_name = "norm_def_eps.csv" if defense else "norm_eps.csv"
            decision_name = f"coach_decision_probs_{'def_' if defense else ''}{'LA' if team == 'LAR' else team}.csv"
            ep_rows, dec_rows = read_csv(directory / ep_name), read_csv(directory / decision_name)
            # Each valid situation must be present exactly once.
            expected_keys = {
                (d, dist, yl)
                for d in range(1, 5)
                for yl in range(1, 100)
                for dist in range(1, min(20, yl) + 1)
            }
            for rows, upper in ((ep_rows, True), (dec_rows, False)):
                names = (
                    ("Down", "Distance", "Yardline") if upper else ("down", "distance", "yardline")
                )
                keys = [tuple(int(r[k]) for k in names) for r in rows]
                if len(keys) != len(set(keys)) or set(keys) != expected_keys:
                    raise ValueError(
                        f"Incomplete or duplicate situations for {team} {year} {ep_name if upper else decision_name}"
                    )
            for row in ep_rows:
                ep = float(row["EP"])
                if not math.isfinite(ep):
                    raise ValueError("Nonfinite EP")
                choice = int(row["Opt_Choice"])
                if choice not in range(4):
                    raise ValueError("Invalid optimal choice")
                records["expected_points"].append(
                    dict(
                        year=year,
                        team=team,
                        is_defense=defense,
                        down=int(row["Down"]),
                        distance=int(row["Distance"]),
                        yardline=int(row["Yardline"]),
                        ep=ep,
                        opt_choice=choice,
                    )
                )
            for row in dec_rows:
                weights = [float(row[k]) for k in ("run", "pass", "kick", "punt")]
                if any(not math.isfinite(v) or v < 0 for v in weights) or sum(weights) <= 0:
                    raise ValueError("Invalid coaching probabilities")
                total = sum(weights)
                records["coach_decision_probs"].append(
                    dict(
                        year=year,
                        team=team,
                        is_defense=defense,
                        down=int(row["down"]),
                        distance=int(row["distance"]),
                        yardline=int(row["yardline"]),
                        **dict(
                            zip(
                                ("run_prob", "pass_prob", "kick_prob", "punt_prob"),
                                [v / total for v in weights],
                            )
                        ),
                    )
                )
            files = sorted((directory / ("cdf_data_def" if defense else "cdf_data")).glob("*.json"))
            if len(files) != 58:
                raise ValueError(f"Expected 58 CDF files for {team}")
            for file in files:
                play, bin_name = file.stem.split("_cdf_yl")
                entries = json.loads(file.read_text())
                if set(entries) != {f"{d}-{dist}" for d in range(1, 5) for dist in range(1, 21)}:
                    raise ValueError(f"Incomplete CDF: {file}")
                for key, entry in sorted(entries.items()):
                    values = (
                        entry["values"] if isinstance(entry["values"], list) else [entry["values"]]
                    )
                    cdf = entry["cdf"] if isinstance(entry["cdf"], list) else [entry["cdf"]]
                    try:
                        pdf(dict(values_json=values, cdf_json=cdf))
                    except DataUnavailable as exc:
                        raise ValueError(f"Invalid CDF {file}, situation {key}: {exc}") from exc
                    down, distance = map(int, key.split("-"))
                    records["play_cdf"].append(
                        dict(
                            year=year,
                            team=team,
                            is_defense=defense,
                            down=down,
                            distance=distance,
                            yardline_bin=bin_name,
                            play_type="rush" if play == "rush" else "pass",
                            values_json=values,
                            cdf_json=cdf,
                        )
                    )
    punts = json.loads((season / "punt_net_yards.json").read_text())
    kicks = {int(r["yardline"]): float(r["kick_prob"]) for r in read_csv(season / "kick_probs.csv")}
    for yl in range(1, 100):
        values = punts.get(str(yl))
        prob = kicks.get(yl)
        if not isinstance(values, list) or not values or prob is None or not 0 <= prob <= 1:
            raise ValueError(f"Invalid special teams data at {yl}")
        records["special_teams"].append(
            dict(year=year, yardline=yl, punt_values=values, kick_prob=prob)
        )
    profile_path = season / "team_profiles.json"
    if profile_path.exists():
        profiles = json.loads(profile_path.read_text())
        if set(profiles) != set(manifest["teams"]):
            raise ValueError("Special-teams profiles must match the manifest teams")
        for team, profile in profiles.items():
            validate_profile(profile)
            records["team_profiles"].append(dict(year=year, team=team, profile_json=profile))
    weights = {
        (int(r["down"]), int(r["distance"]), int(r["yardline"])): int(r["frequency"])
        for r in read_csv(season / "frequency.csv")
    }
    for team in manifest["teams"]:
        if team == "NFL":
            continue
        scores = []
        for defense in (False, True):
            rows = [
                r
                for r in records["expected_points"]
                if r["team"] == team
                and r["is_defense"] == defense
                and r["down"] == 1
                and r["distance"] == min(10, r["yardline"])
            ]
            denom = sum(weights.get((r["down"], r["distance"], r["yardline"]), 0) for r in rows)
            if not denom:
                raise ValueError("No first-down frequency weights for rankings")
            scores.append(
                sum(
                    r["ep"] * weights.get((r["down"], r["distance"], r["yardline"]), 0)
                    for r in rows
                )
                / denom
            )
        records["rankings"].append(dict(year=year, team=team, offense=scores[0], defense=scores[1]))
    return manifest, records


def import_season(settings, season):
    manifest, records = dataset_records(season)
    from .storage import LocalRepository

    LocalRepository(settings.database).publish(manifest, records)
    return manifest


def build(settings, year, teams, threshold=20, iterations=3, seed=25, refresh=False):
    if not 1999 <= year <= 2100:
        raise ValueError("Season must be between 1999 and 2100")
    if threshold < 1 or iterations < 1:
        raise ValueError("Threshold and iterations must be positive")
    teams = sorted({normalize_team(t) for t in teams} - {"NFL"})
    if not teams:
        raise ValueError("Select at least one team")
    if not shutil.which("Rscript"):
        raise RuntimeError("Install R and run make setup-r")
    target = settings.data_dir / "seasons" / str(year)
    if target.exists():
        raise ValueError(
            f"{target} already exists. Use data rebuild --season {year} to replace it explicitly."
        )
    raw = settings.data_dir / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    if refresh:
        (raw / f"pbp_{year}.rds").unlink(missing_ok=True)
    binaries = compile_cpp(settings.data_dir)
    workspace = settings.data_dir / "build"
    workspace.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix=f"{year}-", dir=workspace))
    artifacts = work / "artifacts"
    artifacts.mkdir()
    log = work / "build.log"
    env = {
        **os.environ,
        "NFLSIM_SEED": str(seed),
        "NFLSIM_RAW_DIR": str(raw.resolve()),
        "NFLSIM_PIPELINE_DIR": str(ROOT / "pipeline/r"),
        "R_LIBS_USER": str(settings.data_dir / "r-library"),
    }

    def r(script, *args, cwd=work):
        run(["Rscript", "--vanilla", ROOT / "pipeline/r" / script, *args], cwd, env, log)

    for directory in ("cache_data", "distr_data", "cdf_data", "team-data/NFL"):
        (work / directory).mkdir(parents=True, exist_ok=True)
    print(f"Building season {year}; detailed log: {log}", flush=True)
    r("special_teams.R", year)
    r("team_profiles.R", year, *teams)
    league_special = work / "special-team/NFL"
    league_xp = (league_special / "xp_prob.txt").read_text().strip()
    shutil.copy2(league_special / "kick_probs.csv", work / "kick_probs.csv")
    r("coach_data.R", "NFL", year, "false")
    r("league_data.R", threshold, year)
    r("cdf.R", threshold)
    league = work / "team-data/NFL"
    shutil.copytree(work / "cdf_data", league / "cdf_data")
    league_decisions = league / "coach_decision_probs_NFL.csv"
    naive = league / "naive_eps.csv"
    run(
        [
            binaries / "simulator_naive_norm",
            naive,
            league / "cdf_data",
            league_decisions,
            work / "kick_probs.csv",
            league_xp,
        ],
        work,
        env,
        log,
    )
    prior = naive
    for epoch in range(iterations):
        output = league / f"epoch_{epoch}.csv"
        run(
            [
                binaries / "simulator_norm",
                prior,
                output,
                league_special / "punt_net_yards.json",
                league / "cdf_data",
                league_decisions,
                work / "kick_probs.csv",
                league_xp,
            ],
            work,
            env,
            log,
        )
        prior = output
    shutil.copy2(prior, league / "norm_eps.csv")
    shutil.copy2(prior, league / "norm_def_eps.csv")
    shutil.copy2(league_decisions, league / "coach_decision_probs_def_NFL.csv")
    shutil.copytree(league / "cdf_data", league / "cdf_data_def")
    for name in ("punt_net_yards.json", "kick_probs.csv", "frequency.csv", "team_profiles.json"):
        shutil.copy2(work / name, artifacts / name)
    (artifacts / "teams").mkdir()
    shutil.copytree(league, artifacts / "teams/NFL")
    for public_team in teams:
        team = "LA" if public_team == "LAR" else public_team
        print(f"Building {public_team} {year}", flush=True)
        directory = work / "team-data" / team
        directory.mkdir(exist_ok=True)
        r("coach_data.R", team, year, "false")
        r("coach_data.R", team, year, "true")
        for defense in (False, True):
            r("data_opt.R", team, threshold, year, "true" if defense else "false")
            r("cdf.R", 1)  # The preparation stage pads sparse bins; do not erase them.
            cdf_dir = directory / ("cdf_data_def" if defense else "cdf_data")
            shutil.copytree(work / "cdf_data", cdf_dir)
            dec_name = f"coach_decision_probs_{'def_' if defense else ''}{team}.csv"
            run(
                [
                    binaries / "simulator_norm",
                    league / "norm_eps.csv",
                    directory / ("norm_def_eps.csv" if defense else "norm_eps.csv"),
                    work / "special-team" / public_team / "punt_net_yards.json"
                    if not defense
                    else league_special / "punt_net_yards.json",
                    cdf_dir,
                    directory / dec_name,
                    work / "special-team" / public_team / "kick_probs.csv"
                    if not defense
                    else work / "kick_probs.csv",
                    (work / "special-team" / public_team / "xp_prob.txt").read_text().strip()
                    if not defense
                    else league_xp,
                ],
                work,
                env,
                log,
            )
        shutil.copytree(directory, artifacts / "teams" / public_team)
    for path in artifacts.rglob("*.csv"):
        if path.name not in ("kick_probs.csv", "frequency.csv"):
            canonical_csv(path)
    # Only final EPs are public artifacts; intermediate iterations remain in the build log directory.
    for file in (artifacts / "teams/NFL").glob("epoch_*.csv"):
        file.unlink()
    (artifacts / "teams/NFL/naive_eps.csv").unlink()
    source_hash = hashlib.sha256()
    for path in sorted((ROOT / "pipeline").rglob("*")):
        if path.is_file():
            source_hash.update(path.relative_to(ROOT).as_posix().encode())
            source_hash.update(path.read_bytes())
    manifest = dict(
        schema_version=1,
        year=year,
        teams=["NFL", *teams],
        threshold=threshold,
        iterations=iterations,
        seed=seed,
        source_sha256=source_hash.hexdigest(),
        raw_sha256=hashlib.sha256((raw / f"pbp_{year}.rds").read_bytes()).hexdigest(),
        toolchain={
            "R": subprocess.check_output(
                ["Rscript", "--version"], stderr=subprocess.STDOUT, text=True
            ).strip(),
            "compiler": subprocess.check_output(["c++", "--version"], text=True).splitlines()[0],
        },
        artifacts={
            p.relative_to(artifacts).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(artifacts.rglob("*"))
            if p.is_file()
        },
    )
    (artifacts / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    dataset_records(artifacts)  # Fail before publishing incomplete output.
    target.parent.mkdir(parents=True, exist_ok=True)
    artifacts.rename(target)
    import_season(settings, target)
    print(f"Season {year} ready: {target}", flush=True)
    return target


def upgrade_special_teams(settings, year):
    """Add profiles to an existing season using cached PBP; never rerun EP solvers."""
    target = settings.data_dir / "seasons" / str(year)
    manifest_path = target / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    if manifest["year"] != year:
        raise ValueError("Season argument and artifact manifest do not match")
    raw = settings.data_dir / "raw"
    if not (raw / f"pbp_{year}.rds").exists():
        raise ValueError("Cached raw season missing; this command does not download data")
    checksum = hashlib.sha256((raw / f"pbp_{year}.rds").read_bytes()).hexdigest()
    if manifest.get("raw_sha256") and checksum != manifest["raw_sha256"]:
        raise ValueError("Cached raw data differs from this season's original snapshot")
    workspace = settings.data_dir / "build"
    workspace.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix=f"{year}-special-", dir=workspace))
    env = {
        **os.environ,
        "NFLSIM_OFFLINE": "1",
        "NFLSIM_SEED": str(manifest["seed"]),
        "NFLSIM_RAW_DIR": str(raw.resolve()),
        "NFLSIM_PIPELINE_DIR": str(ROOT / "pipeline/r"),
        "R_LIBS_USER": str(settings.data_dir / "r-library"),
    }
    teams = sorted(set(manifest["teams"]) - {"NFL"})
    run(
        ["Rscript", "--vanilla", ROOT / "pipeline/r/team_profiles.R", year, *teams],
        work,
        env,
        work / "build.log",
    )
    content = (work / "team_profiles.json").read_bytes()
    profiles = json.loads(content)
    if set(profiles) != set(manifest["teams"]):
        raise ValueError("Special-teams profiles must match the manifest teams")
    for profile in profiles.values():
        validate_profile(profile)
    manifest["artifacts"]["team_profiles.json"] = hashlib.sha256(content).hexdigest()
    manifest["special_teams_upgrade"] = {
        "source_sha256": hashlib.sha256(
            (ROOT / "pipeline/r/team_profiles.R").read_bytes()
        ).hexdigest(),
        "ep_tables_recomputed": False,
    }
    profile_path = target / "team_profiles.json"
    old_profile = profile_path.read_bytes() if profile_path.exists() else None
    old_manifest = manifest_path.read_bytes()
    try:
        temporary = target / "team_profiles.json.tmp"
        temporary.write_bytes(content)
        temporary.replace(profile_path)
        temporary = target / "manifest.json.tmp"
        temporary.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
        temporary.replace(manifest_path)
        import_season(settings, target)
    except Exception:
        if old_profile is None:
            profile_path.unlink(missing_ok=True)
        else:
            profile_path.write_bytes(old_profile)
        manifest_path.write_bytes(old_manifest)
        raise
    print(f"Season {year} special teams upgraded; existing EP tables retained", flush=True)
