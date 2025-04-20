# Loads NFL team data from disk into Supabase (CSV + JSON files) with raw HTTP debug insert
import os
import json
import pandas as pd
import httpx
from supabase import create_client, Client

# Supabase config
SUPABASE_URL = "https://umzwlyupfqvqhiuqlggo.supabase.co"
with open(".supabase-key", "r") as f:
    SUPABASE_KEY = f.read().strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# YEARS = [2019, 2020, 2021, 2022, 2023, 2024]
YEARS = [2021, 2022, 2023, 2024]
ROOT = "team_data"
BATCH_SIZE = 500

# ---- BATCH INSERT ---- #
def insert_rows(table, rows):
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i+BATCH_SIZE]
        try:
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }
            res = httpx.post(
                f"{SUPABASE_URL}/rest/v1/{table}",
                headers=headers,
                json=batch
            )
            if res.status_code != 201:
                print("Raw insert error:")
                print("Status:", res.status_code)
                print("Detail:", res.text)
                print("Batch size:", len(batch))
            else:
                print(f"Inserted {len(batch)} rows to {table}")
        except Exception as e:
            print("Exception during raw insert:", e)

# ---- LOAD DATA ---- #
for year in YEARS:
    print(f"Processing year {year}")
    year_path = os.path.join(ROOT, f"team-data{year}")
    for team in os.listdir(year_path):
        team_path = os.path.join(year_path, team)
        if not os.path.isdir(team_path): continue

        print(f"Processing team {team} ({year})")

        # --- Load decision CSVs --- #
        for f in os.listdir(team_path):
            full = os.path.join(team_path, f)
            if f.endswith(".csv") and f.startswith("coach_decision_probs"):
                is_def = "def" in f
                print(f"Loading {f}")
                df = pd.read_csv(full)
                df.columns = [c.lower() for c in df.columns]
                df.rename(columns={
                    "run": "run_prob",
                    "pass": "pass_prob",
                    "kick": "kick_prob",
                    "punt": "punt_prob"
                }, inplace=True)

                df = df.fillna({
                    "down": 0,
                    "distance": 0,
                    "yardline": 0,
                    "run_prob": 0.0,
                    "pass_prob": 0.0,
                    "kick_prob": 0.0,
                    "punt_prob": 0.0,
                    "num_plays": 0
                })

                df = df.astype({
                    "run_prob": "float32",
                    "pass_prob": "float32",
                    "kick_prob": "float32",
                    "punt_prob": "float32",
                    "num_plays": "int32"
                })

                df["team"] = team
                df["year"] = year
                df["is_defense"] = is_def

                expected_cols = [
                    "down", "distance", "yardline",
                    "run_prob", "pass_prob", "kick_prob", "punt_prob",
                    "num_plays", "team", "year", "is_defense"
                ]
                df = df.reindex(columns=expected_cols, fill_value=0)

                insert_rows("coach_decision_probs", df.to_dict("records"))

        # --- Load EP CSVs --- #
        for ep_file in ["norm_eps.csv", "norm_def_eps.csv"]:
            path = os.path.join(team_path, ep_file)
            if os.path.exists(path):
                is_def = "def" in ep_file
                print(f"Loading {ep_file}")
                df = pd.read_csv(path)
                df.columns = [c.lower() for c in df.columns]
                df = df.astype({
                    "run_ep": "float32",
                    "pass_ep": "float32",
                    "kick_ep": "float32",
                    "punt_ep": "float32",
                    "ep": "float32"
                }, errors='ignore')
                df["team"] = team
                df["year"] = year
                df["is_defense"] = is_def
                insert_rows("expected_points", df.to_dict("records"))

        # --- Load CDF JSONs (pass + rush) --- #
        for folder, is_def in [("cdf_data", False), ("cdf_data_def", True)]:
            cdf_dir = os.path.join(team_path, folder)
            if not os.path.isdir(cdf_dir): continue
            for jf in os.listdir(cdf_dir):
                if not jf.endswith(".json"): continue
                play_type = "rush" if "rush" in jf else "pass"
                yard_bin = jf.replace(".json", "").replace("rush_cdf_yl", "").replace("pass_cdf_yl", "")
                print(f"Loading CDF {jf}")
                with open(os.path.join(cdf_dir, jf)) as f:
                    data = json.load(f)
                rows = []
                for key, val in data.items():
                    try:
                        down, distance = map(int, key.split("-"))
                        values = val["values"] if isinstance(val["values"], list) else [val["values"]]
                        cdf = val["cdf"] if isinstance(val["cdf"], list) else [val["cdf"]]
                        values = [int(v) for v in values]  # Convert values to int
                        cdf = [round(float(c), 6) for c in cdf]  # Reduce precision
                        row = dict(
                            team=team, year=year, yardline_bin=yard_bin, down=down, distance=distance,
                            values=values, cdf=cdf, is_defense=is_def, play_type=play_type
                        )
                        rows.append(row)
                    except Exception as e:
                        print(f"CDF skip {key} from {jf} for {team} ({year}) — {e}")
                if rows:
                    insert_rows("play_cdf", rows)

print("Upload complete.")