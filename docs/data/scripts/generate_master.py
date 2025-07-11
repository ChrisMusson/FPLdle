import json
from pathlib import Path

import pandas as pd

FINAL_COLS = ["season", "name", "pos", "team", "age", "points", "minutes", "goals", "assists", "yellow_cards", "red_cards", "own_goals"]

parent_dir = Path(__file__).resolve().parent.parent
pos_map = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}
with open(parent_dir / "team_map.json", "r") as f:
    team_map = {int(k): v for k, v in json.load(f).items()}

fpl = pd.read_csv(parent_dir / "fpl.csv")
dob = pd.read_csv(parent_dir / "ids_with_dob.csv")[["code", "dob", "display_name"]]


fpl = fpl.loc[fpl["element_type"] != 5]
fpl["pos"] = fpl["element_type"].map(pos_map)
fpl["team"] = fpl["team_code"].map(team_map)

df = fpl.merge(dob, how="left", on="code")
df = df.loc[~df["dob"].isna()]

df["dob"] = pd.to_datetime(df["dob"], unit="ms")
today = pd.Timestamp.today()
df["age"] = (
    today.year - df["dob"].dt.year - ((today.month < df["dob"].dt.month) | ((today.month == df["dob"].dt.month) & (today.day < df["dob"].dt.day)))
)
df = df.rename(columns={"goals_scored": "goals", "total_points": "points", "display_name": "name"})
df = df[FINAL_COLS]

print(df)
df.to_csv(parent_dir / "master.csv", encoding="utf-8", index=False)
