"""Synthetic data only: tests never download seasons or use a hosted database."""

from copy import deepcopy
import json
import sqlite3

import pytest

from nflsim.config import Settings
from nflsim.storage import LocalRepository, SCHEMA


class MemoryRepository:
    def __init__(self):
        self.records = {}
        self.manifests = [{"year": 2030, "teams": ["NFL", "PHI", "KC"], "seed": 25}]

    def seasons(self):
        return deepcopy(self.manifests)

    def rows(self, table, **filters):
        return [
            deepcopy(r)
            for r in self.records.get(table, [])
            if all(r.get(k) == v for k, v in filters.items())
        ]


@pytest.fixture
def repo():
    repo = MemoryRepository()
    for team in ("NFL", "PHI", "KC"):
        for defense in (False, True):
            common = dict(year=2030, team=team, is_defense=defense)
            for yl in range(1, 100):
                for down in range(1, 5):
                    for dist in range(1, min(20, yl) + 1):
                        situation = dict(**common, down=down, distance=dist, yardline=yl)
                        repo.records.setdefault("expected_points", []).append(
                            dict(**situation, ep=0.0, opt_choice=0)
                        )
                        repo.records.setdefault("coach_decision_probs", []).append(
                            dict(
                                **situation,
                                run_prob=1.0,
                                pass_prob=0.0,
                                kick_prob=0.0,
                                punt_prob=0.0,
                            )
                        )
            from nflsim.engine import yardline_bin

            for bin_name in sorted({yardline_bin(yl) for yl in range(1, 100)}):
                for down in range(1, 5):
                    for dist in range(1, 21):
                        for play in ("rush", "pass"):
                            repo.records.setdefault("play_cdf", []).append(
                                dict(
                                    **common,
                                    down=down,
                                    distance=dist,
                                    yardline_bin=bin_name,
                                    play_type=play,
                                    values_json=[3],
                                    cdf_json=[1.0],
                                )
                            )
    repo.records["special_teams"] = [
        dict(year=2030, yardline=yl, punt_values=[min(40, yl)], kick_prob=1.0)
        for yl in range(1, 100)
    ]
    repo.records["rankings"] = [
        dict(year=2030, team=team, offense=1.0, defense=0.0) for team in ("PHI", "KC")
    ]
    return repo


@pytest.fixture
def local_repo(tmp_path, repo):
    settings = Settings(tmp_path)
    with sqlite3.connect(settings.database) as conn:
        conn.executescript(SCHEMA)
        conn.execute("INSERT INTO seasons VALUES (?,?)", (2030, json.dumps(repo.manifests[0])))
        for table, rows in repo.records.items():
            columns = list(rows[0])
            conn.executemany(
                f"INSERT INTO {table} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})",
                [
                    [json.dumps(r[k]) if isinstance(r[k], list) else r[k] for k in columns]
                    for r in rows
                ],
            )
    return settings, LocalRepository(settings.database)
