import json
from pathlib import Path

import pandas as pd

FINAL_COLS = ["season", "name", "pos", "team", "dob", "points", "minutes", "goals", "assists", "yellow_cards", "red_cards", "own_goals"]

parent_dir = Path(__file__).resolve().parent.parent
pos_map = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}
with open(parent_dir / "team_map.json", "r") as f:
    team_map = {int(k): v for k, v in json.load(f).items()}


def fallback_name(row):
    """Builds a display name for players missing from footballapi.json, e.g. "Martín Zubimendi Ibáñez" -> "Martín Zubimendi"."""
    first, second = row["first_name"], row["second_name"]
    web = row["web_name"].split(".")[-1]
    if row["web_name"].startswith(first):
        return row["web_name"]
    if second.lower().startswith(web.lower()) and second != web:
        return f"{first} {web}"
    return f"{first} {second}"


fpl = pd.read_csv(parent_dir / "fpl.csv", low_memory=False)
dob = pd.read_csv(parent_dir / "ids_with_dob.csv")[["code", "dob", "display_name"]]

fpl = fpl.loc[fpl["element_type"] != 5]
fpl["pos"] = fpl["element_type"].map(pos_map)
fpl["team"] = fpl["team_code"].map(team_map)

df = fpl.merge(dob, how="left", on="code")

# Newer seasons aren't in footballapi.json, but vaastav's data has birth dates from 2024/25 onwards
birth_date = pd.to_datetime(df["birth_date"].where(df["birth_date"] != "None"), errors="coerce")
df["dob"] = df["dob"].fillna((birth_date - pd.Timestamp("1970-01-01")) // pd.Timedelta(milliseconds=1))
df["display_name"] = df["display_name"].fillna(df.apply(fallback_name, axis=1))
df = df.loc[~df["dob"].isna()]

# df["dob"] = pd.to_datetime(df["dob"], unit="ms")
# today = pd.Timestamp.today()
df = df.rename(columns={"goals_scored": "goals", "total_points": "points", "display_name": "name"})
df = df[FINAL_COLS]

print(df)
df.to_csv(parent_dir / "master.csv", encoding="utf-8", index=False)
