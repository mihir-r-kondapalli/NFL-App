import json
import os
import shutil
import subprocess

import pytest

from nflsim.config import ROOT, Settings
from nflsim.pipeline import dataset_records, upgrade_special_teams
from nflsim.profiles import validate_profile
from test_pipeline import artifacts as artifacts


def test_special_teams_upgrade_without_raw_cache_never_downloads(tmp_path):
    target = tmp_path / "seasons" / "2030"
    target.mkdir(parents=True)
    (target / "manifest.json").write_text(
        json.dumps(dict(year=2030, teams=["NFL", "PHI"], seed=25))
    )
    with pytest.raises(ValueError, match="does not download"):
        upgrade_special_teams(Settings(tmp_path), 2030)


def test_profile_artifact_imports_and_rejects_invalid_weights(artifacts):
    # Use the complete synthetic artifact fixture from test_pipeline.
    from test_clock_matchups import profile

    content = {t: profile() for t in ("NFL", "PHI", "KC")}
    path = artifacts / "team_profiles.json"
    path.write_text(json.dumps(content))
    _, records = dataset_records(artifacts)
    assert len(records["team_profiles"]) == 3
    content["PHI"]["kickoffs"][0]["weight"] = 0.5
    path.write_text(json.dumps(content))
    with pytest.raises(ValueError, match="sum to one"):
        dataset_records(artifacts)


def test_r_profiles_use_kicking_team_and_recovery_team(tmp_path):
    if not shutil.which("Rscript"):
        pytest.skip("R is optional for API-only development")
    env = {
        **os.environ,
        "NFLSIM_PIPELINE_DIR": str(ROOT / "pipeline/r"),
        "NFLSIM_RAW_DIR": str(tmp_path),
        "NFLSIM_OFFLINE": "1",
        "R_LIBS_USER": str(ROOT / "data/r-library"),
    }
    probe = subprocess.run(
        [
            "Rscript",
            "--vanilla",
            "-e",
            'quit(status=if(all(vapply(c("nflfastR","dplyr","jsonlite","readr"),requireNamespace,logical(1),quietly=TRUE)))0 else 1)',
        ],
        env=env,
        capture_output=True,
        timeout=30,
    )
    if probe.returncode:
        pytest.skip("Run make setup-r to enable R integration")
    fixture = """
    p <- data.frame(season_type="REG",
      play_type=c("punt","punt","kickoff","kickoff","field_goal","field_goal","extra_point","extra_point"),
      posteam=c("PHI","PHI","KC","PHI","PHI","KC","PHI","KC"),
      defteam=c("KC","KC","PHI","KC","KC","PHI","KC","PHI"),
      yardline_100=c(40,40,35,35,25,25,15,15),
      kick_distance=c(35,45,65,65,42,42,33,33),
      return_yards=c(5,10,20,0,0,0,0,0),
      return_touchdown=0, touchback=c(0,0,0,1,0,0,0,0),
      fumble_recovery_1_team=c("PHI","KC",NA,NA,NA,NA,NA,NA),
      fumbled_1_team=c("KC","PHI",NA,NA,NA,NA,NA,NA),
      fumble_lost=c(1,1,0,0,0,0,0,0),
      field_goal_result=c(NA,NA,NA,NA,"made","missed",NA,NA),
      extra_point_result=c(NA,NA,NA,NA,NA,NA,"good","failed"),
      desc=c("MUFF recovered PHI","blocked punt",rep("",6)),
      yards_gained=0, down=1, ydstogo=10)
    saveRDS(p,"pbp_2030.rds")
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
        ["Rscript", "--vanilla", str(ROOT / "pipeline/r/team_profiles.R"), "2030", "PHI", "KC"],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    profiles = json.loads((tmp_path / "team_profiles.json").read_text())
    for p in profiles.values():
        validate_profile(p)
    assert profiles["PHI"]["fg_probs"][24] > profiles["KC"]["fg_probs"][24]
    assert profiles["PHI"]["xp_prob"] > profiles["KC"]["xp_prob"]
    punts = profiles["PHI"]["punts"]["40"]["values"]
    assert 1130 in punts and 35 in punts and 1135 not in punts
    phi_kicks = {r["loc"]: r["weight"] for r in profiles["PHI"]["kickoffs"]}
    kc_kicks = {r["loc"]: r["weight"] for r in profiles["KC"]["kickoffs"]}
    assert phi_kicks[80] > kc_kicks[80]  # PHI kicked the return to the receiving 20.


def test_upgrade_rolls_back_artifacts_if_import_fails(tmp_path, monkeypatch):
    from test_clock_matchups import profile

    target = tmp_path / "seasons" / "2030"
    target.mkdir(parents=True)
    manifest = dict(year=2030, teams=["NFL", "PHI"], seed=25, artifacts={})
    before = json.dumps(manifest)
    (target / "manifest.json").write_text(before)
    old_profile = '{"old":true}'
    (target / "team_profiles.json").write_text(old_profile)
    raw = tmp_path / "raw"
    raw.mkdir()
    (raw / "pbp_2030.rds").write_bytes(b"synthetic cached data")

    def fake_r(command, cwd, env, log):
        assert env["NFLSIM_OFFLINE"] == "1"
        (cwd / "team_profiles.json").write_text(json.dumps({t: profile() for t in ("NFL", "PHI")}))

    def failed_import(*args):
        raise ValueError("Synthetic import failure")

    monkeypatch.setattr("nflsim.pipeline.run", fake_r)
    monkeypatch.setattr("nflsim.pipeline.import_season", failed_import)
    with pytest.raises(ValueError, match="Synthetic import"):
        upgrade_special_teams(Settings(tmp_path), 2030)
    assert (target / "manifest.json").read_text() == before
    assert (target / "team_profiles.json").read_text() == old_profile
