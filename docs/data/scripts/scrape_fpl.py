from pathlib import Path

import pandas as pd

parent_dir = Path(__file__).resolve().parent.parent

dfs = []
for start_season in range(2016, 2025):
    url = f"https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/refs/heads/master/data/{start_season}-{start_season - 1999}/players_raw.csv"
    df = pd.read_csv(url)
    df.insert(loc=0, column="season", value=f"{start_season}/{start_season - 1999}")
    dfs.append(df)

df = pd.concat(dfs)

# url = "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/refs/heads/master/data/cleaned_merged_seasons_team_aggregated.csv"
# df = pd.read_csv(url)
df.to_csv(parent_dir / "fpl.csv", encoding="utf-8", index=False)
