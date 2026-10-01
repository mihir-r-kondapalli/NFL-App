"""The same normalized records back local SQLite and hosted Supabase."""

import json
import sqlite3
from contextlib import closing
from typing import Protocol

from .config import Settings, normalize_team

SCHEMA = """
CREATE TABLE IF NOT EXISTS seasons (year INTEGER PRIMARY KEY, manifest TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS expected_points (
 year INTEGER, team TEXT, is_defense INTEGER, down INTEGER, distance INTEGER,
 yardline INTEGER, ep REAL, opt_choice INTEGER,
 PRIMARY KEY (year,team,is_defense,down,distance,yardline));
CREATE TABLE IF NOT EXISTS coach_decision_probs (
 year INTEGER, team TEXT, is_defense INTEGER, down INTEGER, distance INTEGER,
 yardline INTEGER, run_prob REAL, pass_prob REAL, kick_prob REAL, punt_prob REAL,
 PRIMARY KEY (year,team,is_defense,down,distance,yardline));
CREATE TABLE IF NOT EXISTS play_cdf (
 year INTEGER, team TEXT, is_defense INTEGER, down INTEGER, distance INTEGER,
 yardline_bin TEXT, play_type TEXT, values_json TEXT, cdf_json TEXT,
 PRIMARY KEY (year,team,is_defense,down,distance,yardline_bin,play_type));
CREATE TABLE IF NOT EXISTS special_teams (
 year INTEGER, yardline INTEGER, punt_values TEXT, kick_prob REAL,
 PRIMARY KEY (year,yardline));
CREATE TABLE IF NOT EXISTS rankings (
 year INTEGER, team TEXT, offense REAL, defense REAL,
 PRIMARY KEY (year,team));
CREATE TABLE IF NOT EXISTS team_profiles (
 year INTEGER, team TEXT, profile_json TEXT NOT NULL,
 PRIMARY KEY (year,team));
"""
TABLES = {
    "expected_points",
    "coach_decision_probs",
    "play_cdf",
    "special_teams",
    "rankings",
    "team_profiles",
}


class DataUnavailable(ValueError):
    pass


class ScheduleRepository:
    """Portable schedule cache; storage details stay outside season business logic."""

    def __init__(self, directory):
        self.directory = directory

    def seasons(self):
        return []

    def rows(self, table, **filters):
        if table != "schedule" or set(filters) != {"year"}:
            raise ValueError("Schedule queries require an explicit year")
        path = self.directory / f"{filters['year']}.json"
        if not path.exists():
            return []
        payload = json.loads(path.read_text())
        if payload["season"] != filters["year"]:
            raise ValueError("Cached schedule season mismatch")
        return payload["games"]

    def save(self, season, games, source, checksum):
        self.directory.mkdir(parents=True, exist_ok=True)
        path = self.directory / f"{season}.json"
        temporary = path.with_suffix(".json.tmp")
        temporary.write_text(
            json.dumps(
                dict(season=season, source=source, source_sha256=checksum, games=games), indent=2
            )
            + "\n"
        )
        temporary.replace(path)


class Repository(Protocol):
    def seasons(self): ...
    def rows(self, table: str, **filters): ...


class LocalRepository:
    def __init__(self, path):
        self.path = path

    def _connect(self):
        if not self.path.exists():
            raise DataUnavailable("No generated data is available. Generate a season first.")
        conn = sqlite3.connect(f"{self.path.as_uri()}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        return conn

    def seasons(self):
        if not self.path.exists():
            return []
        with closing(self._connect()) as conn:
            return [
                json.loads(row[0])
                for row in conn.execute("SELECT manifest FROM seasons ORDER BY year")
            ]

    def rows(self, table, **filters):
        if table not in TABLES:
            raise ValueError("Unknown data table")
        allowed = {
            "year",
            "team",
            "is_defense",
            "down",
            "distance",
            "yardline",
            "yardline_bin",
            "play_type",
        }
        if not filters.keys() <= allowed:
            raise ValueError("Unknown data filter")
        clauses = " AND ".join(f"{key} = ?" for key in filters)
        query = f"SELECT * FROM {table}" + (f" WHERE {clauses}" if clauses else "")
        with closing(self._connect()) as conn:
            if (
                table == "team_profiles"
                and not conn.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='team_profiles'"
                ).fetchone()
            ):
                return []  # Older local seasons retain their league-wide fallback.
            records = [dict(row) for row in conn.execute(query, list(filters.values()))]
        for row in records:
            if "is_defense" in row:
                row["is_defense"] = bool(row["is_defense"])
            for key in ("values_json", "cdf_json", "punt_values", "profile_json"):
                if key in row:
                    row[key] = json.loads(row[key])
        return records

    def publish(self, manifest, records):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self.path)) as conn:
            conn.executescript(SCHEMA)
            with conn:
                for table, rows in records.items():
                    if table not in TABLES:
                        raise ValueError("Unknown data table")
                    conn.execute(f"DELETE FROM {table} WHERE year = ?", [manifest["year"]])
                    if not rows:
                        continue
                    columns = list(rows[0])
                    values = [
                        [
                            json.dumps(r[k], separators=(",", ":"))
                            if isinstance(r[k], (list, dict))
                            else r[k]
                            for k in columns
                        ]
                        for r in rows
                    ]
                    conn.executemany(
                        f"INSERT INTO {table} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})",
                        values,
                    )
                conn.execute(
                    "INSERT OR REPLACE INTO seasons VALUES (?, ?)",
                    [manifest["year"], json.dumps(manifest, sort_keys=True)],
                )


class SupabaseRepository:
    def __init__(self, settings):
        if not settings.supabase_url or not settings.supabase_key:
            raise ValueError("Supabase provider requires SUPABASE_URL and SUPABASE_KEY")
        import httpx

        self.client = httpx.Client(
            base_url=settings.supabase_url.rstrip("/") + "/rest/v1/",
            headers={
                "apikey": settings.supabase_key,
                "Authorization": f"Bearer {settings.supabase_key}",
                "Accept-Profile": settings.supabase_schema,
                "Content-Profile": settings.supabase_schema,
                "Prefer": "resolution=merge-duplicates",
            },
            timeout=30,
        )

    def rows(self, table, **filters):
        if table not in TABLES | {"seasons"}:
            raise ValueError("Unknown data table")
        params = {
            "select": "*",
            "order": {
                "seasons": "year",
                "rankings": "year,team",
                "team_profiles": "year,team",
                "special_teams": "year,yardline",
                "play_cdf": "year,team,is_defense,down,distance,yardline_bin,play_type",
            }.get(table, "year,team,is_defense,down,distance,yardline"),
            **{k: f"eq.{str(v).lower() if isinstance(v, bool) else v}" for k, v in filters.items()},
        }
        # PostgREST defaults to 1,000 rows; page explicitly for EP and CDF queries.
        records = []
        while True:
            response = self.client.get(
                table, params={**params, "offset": len(records), "limit": 1000}
            )
            response.raise_for_status()
            page = response.json()
            records.extend(page)
            if len(page) < 1000:
                return records

    def seasons(self):
        return sorted([r["manifest"] for r in self.rows("seasons")], key=lambda r: r["year"])

    def publish(self, manifest, tables):
        # Remove readiness while uploading. Requests require the manifest to read data.
        self.client.delete("seasons", params={"year": f"eq.{manifest['year']}"}).raise_for_status()
        for table, rows in tables.items():
            if table not in TABLES:
                raise ValueError("Unknown data table")
            self.client.delete(table, params={"year": f"eq.{manifest['year']}"}).raise_for_status()
            for index in range(0, len(rows), 500):
                self.client.post(table, json=rows[index : index + 500]).raise_for_status()
        self.client.post(
            "seasons", json=[{"year": manifest["year"], "manifest": manifest}]
        ).raise_for_status()

    def close(self):
        self.client.close()


def repository(settings: Settings):
    if settings.provider == "local":
        return LocalRepository(settings.database)
    if settings.provider == "supabase":
        return SupabaseRepository(settings)
    raise ValueError("NFLSIM_DATA_PROVIDER must be local or supabase")


def require_team(repo, year, team):
    team = normalize_team(team)
    manifest = next((s for s in repo.seasons() if s["year"] == year), None)
    if not manifest or team not in manifest["teams"]:
        raise DataUnavailable(f"No data for {team} in {year}. Generate that season/team first.")
    return team
