from pathlib import Path

import pandas as pd
import requests

parent_dir = Path(__file__).resolve().parent.parent
CURRENT_SEASON = 2026  # vaastav lags behind during a season, so this one comes from the FPL API instead
FPL_API_URL = "https://fantasy.premierleague.com/api"
HEADERS = {"User-Agent": "Mozilla/5.0"}

dfs = []
for start_season in range(2016, CURRENT_SEASON):
    url = f"https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/refs/heads/master/data/{start_season}-{start_season - 1999}/players_raw.csv"
    df = pd.read_csv(url)
    df.insert(loc=0, column="season", value=f"{start_season}/{start_season - 1999}")
    dfs.append(df)

bootstrap = requests.get(f"{FPL_API_URL}/bootstrap-static/", headers=HEADERS).json()
df = pd.DataFrame(bootstrap["elements"])
df.insert(loc=0, column="season", value=f"{CURRENT_SEASON}/{CURRENT_SEASON - 1999}")
dfs.append(df)

df = pd.concat(dfs)

# url = "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/refs/heads/master/data/cleaned_merged_seasons_team_aggregated.csv"
# df = pd.read_csv(url)
df.to_csv(parent_dir / "fpl.csv", encoding="utf-8", index=False)
