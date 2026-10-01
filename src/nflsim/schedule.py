"""Explicit nflverse schedule ingestion and shared-engine regular-season simulation."""

import csv
import hashlib
import io
import json
from collections import Counter

import httpx

from .config import TEAMS, normalize_team
from .models import GameState, SimulationRequest

SOURCE = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv"


def validate_games(games, season, complete=True):
    if not 2002 <= season <= 2100:
        raise ValueError("Schedule simulation supports the 32-team era, 2002 onward")
    if not games:
        raise ValueError(f"No regular-season schedule for {season}")
    ids, slots, counts = set(), set(), Counter()
    for game in games:
        home, away = normalize_team(game["home_team"]), normalize_team(game["away_team"])
        if home == away or "NFL" in (home, away):
            raise ValueError("Schedule must contain two different NFL teams")
        if game["season"] != season or game["game_type"] != "REG":
            raise ValueError("Schedule season/type mismatch")
        week = game["week"]
        if not isinstance(week, int) or not 1 <= week <= (18 if season >= 2021 else 17):
            raise ValueError("Invalid schedule week")
        if not game["game_id"] or game["game_id"] in ids:
            raise ValueError("Duplicate or empty game identifier")
        ids.add(game["game_id"])
        for team in (home, away):
            if (week, team) in slots:
                raise ValueError("Team scheduled twice in one week")
            slots.add((week, team))
            counts[team] += 1
    expected = 17 if season >= 2021 else 16
    # The BUF-CIN game was canceled in 2022; an actual schedule must not invent it.
    required = {team: expected - (season == 2022 and team in ("BUF", "CIN")) for team in TEAMS}
    if complete and (set(counts) != set(TEAMS) or any(counts[t] != n for t, n in required.items())):
        raise ValueError(f"Incomplete schedule: expected {expected} games for each of 32 teams")


def fetch_schedule(store, season, refresh=False):
    """Network access occurs only when the user runs schedule fetch."""
    if not 2002 <= season <= 2100:
        raise ValueError("Schedule simulation supports the 32-team era, 2002 onward")
    cached = store.rows("schedule", year=season)
    if cached and not refresh:
        validate_games(cached, season)
        return cached
    response = httpx.get(SOURCE, timeout=60, follow_redirects=True)
    response.raise_for_status()
    games = []
    reader = csv.DictReader(io.StringIO(response.text))
    required = {"season", "game_type", "game_id", "week", "home_team", "away_team"}
    if not required <= set(reader.fieldnames or []):
        raise ValueError("Upstream schedule is missing required columns")
    for row in reader:
        if row["season"] != str(season) or row["game_type"] != "REG":
            continue
        if (
            season == 2022
            and row["week"] == "17"
            and row["home_team"] == "CIN"
            and row["away_team"] == "BUF"
        ):
            continue  # Exclude the canceled game if the source retains its scheduled row.
        games.append(
            dict(
                game_id=row["game_id"],
                season=season,
                game_type="REG",
                week=int(row["week"]),
                home_team=normalize_team(row["home_team"]),
                away_team=normalize_team(row["away_team"]),
                gameday=row.get("gameday", ""),
                gametime=row.get("gametime", ""),
                location=row.get("location", "Home"),
            )
        )
    validate_games(games, season)
    games.sort(key=lambda r: (r["week"], r["gameday"], r["gametime"], r["game_id"]))
    store.save(season, games, SOURCE, hashlib.sha256(response.content).hexdigest())
    return games


def simulate_season(engine, store, season, seed=25, team=None, week=None, progress=None, playoffs=False):
    if playoffs and (team is not None or week is not None):
        raise ValueError("Playoffs require a complete regular season; omit --team and --week")
    games = store.rows("schedule", year=season)
    validate_games(games, season)
    if team:
        team = normalize_team(team)
    selected = [
        g
        for g in games
        if (not team or team in (g["home_team"], g["away_team"]))
        and (week is None or g["week"] == week)
    ]
    if not selected:
        raise ValueError("No games match the selected team/week")
    # Validate every matchup before starting, rather than failing halfway through.
    for game in selected:
        engine.validate_matchup(
            GameState(team1=game["home_team"], team2=game["away_team"], year1=season, year2=season)
        )
    standings, results = {}, []
    for game in selected:
        game_seed = int.from_bytes(
            hashlib.sha256(f"{season}:{seed}:{game['game_id']}".encode()).digest()[:8], "big"
        )
        result = engine.simulate(
            SimulationRequest(
                team1=game["home_team"],
                team2=game["away_team"],
                year1=season,
                year2=season,
                num_games=1,
                seed=game_seed,
                include_drives=True,
                timing_mode="clock",
            )
        )
        home, away = result["team1_scores"][0], result["team2_scores"][0]
        results.append(
            dict(
                **game,
                seed=game_seed,
                home_score=home,
                away_score=away,
                plays=result["play_counts"][0],
                overtime=result["overtime"][0],
                drives=result.get("drives", [None])[0],
                special_teams=result.get("special_teams", {}),
            )
        )
        if progress:
            progress(len(results), len(selected), results[-1])
        for name, scored, allowed in (
            (game["home_team"], home, away),
            (game["away_team"], away, home),
        ):
            entry = standings.setdefault(
                name, dict(team=name, wins=0, losses=0, ties=0, points_for=0, points_against=0)
            )
            entry["wins" if scored > allowed else "losses" if scored < allowed else "ties"] += 1
            entry["points_for"] += scored
            entry["points_against"] += allowed
    for entry in standings.values():
        played = entry["wins"] + entry["losses"] + entry["ties"]
        entry["win_pct"] = (entry["wins"] + 0.5 * entry["ties"]) / played
    ordered = sorted(standings.values(), key=lambda r: (-r["win_pct"], r["team"]))
    result = dict(
        season=season,
        seed=seed,
        games=results,
        standings=ordered,
        complete=team is None and week is None,
        notes="Regular season only; standings order does not implement NFL tiebreakers. "
        "Home/away identifies schedule roles; no uncalibrated home-field bonus is applied.",
    )

    if playoffs:
        from .playoffs import simulate_playoffs

        result["playoffs"] = simulate_playoffs(engine, result, progress)
        result["notes"] = "Regular-season standings are display-sorted; playoff seeds apply tiebreakers."
    return result


def write_results(path, result):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(result, indent=2) + "\n")
    temporary.replace(path)
