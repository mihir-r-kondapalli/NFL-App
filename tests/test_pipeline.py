import csv
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess

import pytest

from nflsim.config import ROOT, Settings
from nflsim.pipeline import dataset_records, import_season
from nflsim.storage import LocalRepository


def write_csv(path, rows):
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


@pytest.fixture
def artifacts(tmp_path, repo):
    directory = tmp_path / "season"
    directory.mkdir()
    manifest = repo.manifests[0]
    for team in manifest["teams"]:
        target = directory / "teams" / team
        target.mkdir(parents=True)
        for defense in (False, True):
            eps = repo.rows("expected_points", year=2030, team=team, is_defense=defense)
            eps = [
                dict(
                    Down=r["down"],
                    Distance=r["distance"],
                    Yardline=r["yardline"],
                    EP=r["ep"],
                    Opt_Choice=r["opt_choice"],
                )
                for r in eps
            ]
            write_csv(target / ("norm_def_eps.csv" if defense else "norm_eps.csv"), eps)
            dec = repo.rows("coach_decision_probs", year=2030, team=team, is_defense=defense)
            dec = [
                dict(
                    down=r["down"],
                    distance=r["distance"],
                    yardline=r["yardline"],
                    run=r["run_prob"],
                    **{"pass": r["pass_prob"]},
                    kick=r["kick_prob"],
                    punt=r["punt_prob"],
                )
                for r in dec
            ]
            write_csv(target / f"coach_decision_probs_{'def_' if defense else ''}{team}.csv", dec)
            cdf_dir = target / ("cdf_data_def" if defense else "cdf_data")
            cdf_dir.mkdir()
            groups = {}
            for row in repo.rows("play_cdf", year=2030, team=team, is_defense=defense):
                name = f"{row['play_type']}_cdf_yl{row['yardline_bin']}.json"
                groups.setdefault(name, {})[f"{row['down']}-{row['distance']}"] = {
                    "values": row["values_json"],
                    "cdf": row["cdf_json"],
                }
            for name, entries in groups.items():
                (cdf_dir / name).write_text(json.dumps(entries))
    (directory / "punt_net_yards.json").write_text(
        json.dumps({str(r["yardline"]): r["punt_values"] for r in repo.records["special_teams"]})
    )
    write_csv(
        directory / "kick_probs.csv",
        [
            dict(yardline=r["yardline"], kick_prob=r["kick_prob"])
            for r in repo.records["special_teams"]
        ],
    )
    write_csv(
        directory / "frequency.csv",
        [dict(down=1, distance=min(10, yl), yardline=yl, frequency=1) for yl in range(1, 100)],
    )
    manifest["artifacts"] = {
        p.relative_to(directory).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in directory.rglob("*")
        if p.is_file()
    }
    (directory / "manifest.json").write_text(json.dumps(manifest))
    return directory


def test_complete_artifacts_import_and_atomic_validation(tmp_path, artifacts):
    settings = Settings(tmp_path / "data")
    import_season(settings, artifacts)
    local = LocalRepository(settings.database)
    assert local.seasons()[0]["year"] == 2030
    assert (
        len(local.rows("expected_points", year=2030, team="PHI", is_defense=False, down=1)) == 1790
    )
    # A failed reimport leaves the previously published dataset intact.
    path = artifacts / "teams/PHI/norm_eps.csv"
    rows = path.read_text().splitlines()
    path.write_text("\n".join(rows[:-1]) + "\n")
    with pytest.raises(ValueError, match="Incomplete"):
        import_season(settings, artifacts)
    assert (
        len(local.rows("expected_points", year=2030, team="PHI", is_defense=False, down=1)) == 1790
    )
    with sqlite3.connect(settings.database) as conn:
        assert conn.execute("SELECT COUNT(*) FROM seasons").fetchone()[0] == 1


def test_invalid_distribution_rejected(artifacts):
    path = artifacts / "teams/PHI/cdf_data/rush_cdf_yl1.json"
    entries = json.loads(path.read_text())
    entries["1-1"] = {"values": [], "cdf": []}
    path.write_text(json.dumps(entries))
    with pytest.raises(ValueError, match="malformed"):
        dataset_records(artifacts)


def test_cpp_reads_fractional_coach_weights(artifacts, tmp_path):
    # A small synthetic modeling regression; no real season download or games.
    from nflsim.pipeline import compile_cpp

    binaries = compile_cpp(tmp_path / "compiler")
    dec = artifacts / "teams/NFL/coach_decision_probs_NFL.csv"
    rows = list(csv.DictReader(dec.open()))
    for row in rows:
        row.update(run="0.25", **{"pass": "0.75"})
    write_csv(dec, rows)
    output = tmp_path / "naive.csv"
    result = subprocess.run(
        [
            str(binaries / "simulator_naive_norm"),
            str(output),
            str(artifacts / "teams/NFL/cdf_data"),
            str(dec),
            str(artifacts / "kick_probs.csv"),
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    output_rows = list(csv.DictReader(output.open()))
    goal_line = next(
        r for r in output_rows if r["Down"] == "1" and r["Distance"] == "1" and r["Yardline"] == "1"
    )
    assert float(goal_line["EP"]) == pytest.approx(6.945)


def test_r_sources_parse_without_execution():
    import shutil

    if not shutil.which("Rscript"):
        pytest.skip("R is optional for API-only development")
    script = 'invisible(lapply(list.files("pipeline/r", pattern="[.]R$", full.names=TRUE), parse))'
    subprocess.run(["Rscript", "-e", script], cwd=ROOT, check=True, capture_output=True, timeout=20)


def test_cpp_weighted_punts_and_team_extra_points(artifacts, tmp_path):
    from nflsim.pipeline import compile_cpp

    binaries = compile_cpp(tmp_path / "compiler")
    prior = tmp_path / "prior.csv"
    write_csv(
        prior,
        [
            dict(
                Down=1,
                Distance=min(10, yl),
                Yardline=yl,
                Run_EP=0,
                Pass_EP=0,
                Kick_EP=0,
                Punt_EP=0,
                EP=yl / 100,
                Opt_Choice=0,
            )
            for yl in range(1, 100)
        ],
    )
    punts = tmp_path / "weighted_punts.json"
    punts.write_text(
        json.dumps({str(yl): dict(values=[10, 20], weights=[0.25, 0.75]) for yl in range(1, 100)})
    )
    output = tmp_path / "weighted.csv"
    result = subprocess.run(
        [
            str(binaries / "simulator_norm"),
            str(prior),
            str(output),
            str(punts),
            str(artifacts / "teams/NFL/cdf_data"),
            str(artifacts / "teams/NFL/coach_decision_probs_NFL.csv"),
            str(artifacts / "kick_probs.csv"),
            "0.5",
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    rows = list(csv.DictReader(output.open()))
    goal = next(r for r in rows if (r["Down"], r["Distance"], r["Yardline"]) == ("1", "1", "1"))
    assert float(goal["EP"]) == pytest.approx(6.5)
    punt = next(r for r in rows if (r["Down"], r["Distance"], r["Yardline"]) == ("4", "10", "40"))
    assert float(punt["Punt_EP"]) == pytest.approx(-0.775)


def test_special_teams_without_punt_returned_column(tmp_path):
    if not shutil.which("Rscript"):
        pytest.skip("R is optional for API-only development")
    env = {
        **os.environ,
        "NFLSIM_PIPELINE_DIR": str(ROOT / "pipeline/r"),
        "NFLSIM_RAW_DIR": str(tmp_path),
        "R_LIBS_USER": str(ROOT / "data/r-library"),
    }
    probe = subprocess.run(
        [
            "Rscript",
            "--vanilla",
            "-e",
            'quit(status=if (all(vapply(c("nflfastR", "dplyr", "jsonlite", "readr"), '
            "requireNamespace, logical(1), quietly=TRUE))) 0 else 1)",
        ],
        env=env,
        capture_output=True,
        timeout=30,
    )
    if probe.returncode:
        pytest.skip("Run make setup-r to enable the R integration regression")
    fixture = """
    p <- data.frame(season_type="REG",
      play_type=c("punt", "punt", "punt", "punt", "field_goal", "run"),
      yardline_100=40, kick_distance=35, return_yards=c(35, 5, 0, 5, 0, 0),
      return_touchdown=c(1, 0, 0, 0, 0, 0),
      fumble_lost=c(0, 1, 0, 0, 0, 0), touchback=c(0, 0, 1, 0, 0, 0),
      field_goal_result=c(NA, NA, NA, NA, "made", NA), down=1, ydstogo=10)
    saveRDS(p, "pbp_2030.rds")
    """
    subprocess.run(
        ["Rscript", "--vanilla", "-e", fixture],
        cwd=tmp_path,
        env=env,
        check=True,
        capture_output=True,
        timeout=30,
    )
    result = subprocess.run(
        ["Rscript", "--vanilla", str(ROOT / "pipeline/r/special_teams.R"), "2030"],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    punts = json.loads((tmp_path / "punt_net_yards.json").read_text())
    assert punts["40"] == [-1100, 1130, 40, 30]
    kicks = list(csv.DictReader((tmp_path / "kick_probs.csv").open()))
    assert float(kicks[39]["kick_prob"]) == 1
    assert float(kicks[50]["kick_prob"]) == 0


def test_manifest_cannot_change_the_explicitly_selected_season(artifacts):
    mismatched = artifacts.with_name("2031")
    artifacts.rename(mismatched)
    with pytest.raises(ValueError, match="do not match"):
        dataset_records(mismatched)


def test_league_cdfs_filter_missing_yardage_before_padding(tmp_path):
    if not shutil.which("Rscript"):
        pytest.skip("R is optional for API-only development")
    env = {
        **os.environ,
        "NFLSIM_PIPELINE_DIR": str(ROOT / "pipeline/r"),
        "NFLSIM_RAW_DIR": str(tmp_path),
        "R_LIBS_USER": str(ROOT / "data/r-library"),
    }
    probe = subprocess.run(
        [
            "Rscript",
            "--vanilla",
            "-e",
            'quit(status=if (all(vapply(c("nflfastR", "tidyverse", "jsonlite"), '
            "requireNamespace, logical(1), quietly=TRUE))) 0 else 1)",
        ],
        env=env,
        capture_output=True,
        timeout=30,
    )
    if probe.returncode:
        pytest.skip("Run make setup-r to enable the R integration regression")
    # Mixed valid/missing samples, an entirely missing situation, and an empty bin.
    # Singleton sampling must retain the observed value, including turnover codes.
    fixture = """
    p <- data.frame(play_type=c("pass", "pass", "pass", "run"),
      qb_scramble=0, down=c(1, 1, 2, 1), ydstogo=c(1, 1, 2, 1),
      yardline_100=1, game_seconds_remaining=600, season_type="REG",
      yards_gained=c(7, NA, NA, -3), fumble_lost=c(0, 0, 0, 1),
      return_yards=0, rush_touchdown=0, pass_touchdown=0,
      interception=0, air_yards=NA_real_)
    saveRDS(p, "pbp_2030.rds")
    """
    subprocess.run(
        ["Rscript", "--vanilla", "-e", fixture],
        cwd=tmp_path,
        env=env,
        check=True,
        capture_output=True,
        timeout=30,
    )
    for script, args in (("league_data.R", ["20", "2030"]), ("cdf.R", ["20"])):
        result = subprocess.run(
            ["Rscript", "--vanilla", str(ROOT / "pipeline/r" / script), *args],
            cwd=tmp_path,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
        )
        assert result.returncode == 0, result.stderr
    from nflsim.engine import pdf

    files = list((tmp_path / "cdf_data").glob("*.json"))
    assert len(files) == 58
    for path in files:
        entries = json.loads(path.read_text())
        assert len(entries) == 80
        expected = (7 if path.name.startswith("pass") else -1103) if "yl1.json" in path.name else 0
        for entry in entries.values():
            values = entry["values"]
            cdf = entry["cdf"]
            assert pdf(dict(values_json=values, cdf_json=cdf)) == {expected: 1}
