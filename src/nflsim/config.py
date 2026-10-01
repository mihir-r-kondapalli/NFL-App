import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEAMS = tuple(
    "ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAR LAC LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS".split()
)


def normalize_team(team: str) -> str:
    team = team.upper()
    team = {"LA": "LAR", "OAK": "LV", "SD": "LAC"}.get(team, team)
    if team not in (*TEAMS, "NFL"):
        raise ValueError(f"Unknown team: {team}")
    return team


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    provider: str = "local"
    supabase_url: str = ""
    supabase_key: str = ""
    model_path: Path = ROOT / "data/models/strategy.pth"

    supabase_schema: str = "nflsim"

    @classmethod
    def from_env(cls):
        data_dir = Path(os.getenv("NFLSIM_DATA_DIR", str(ROOT / "data"))).resolve()
        return cls(
            data_dir,
            os.getenv("NFLSIM_DATA_PROVIDER", "local"),
            os.getenv("SUPABASE_URL", ""),
            os.getenv("SUPABASE_KEY", ""),
            Path(os.getenv("NFLSIM_MODEL_PATH", str(data_dir / "models/strategy.pth"))),
            os.getenv("NFLSIM_SUPABASE_SCHEMA", "nflsim"),
        )

    @property
    def database(self):
        return self.data_dir / "nflsim.sqlite3"
