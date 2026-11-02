import json
from pathlib import Path

import pandas as pd
import requests

parent_dir = Path(__file__).resolve().parent.parent
VAASTAV_URL = "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/refs/heads/master/data"
FPL_API_URL = "https://fantasy.premierleague.com/api"
HEADERS = {"User-Agent": "Mozilla/5.0"}
FIXTURE_SEASONS = range(2025, 2026)  # Seasons built from vaastav fixtures
CURRENT_SEASON = 2026  # vaastav lags behind during a season, so this one comes from the FPL API instead


def get_vaastav_table(start_season, team_map):
    base = f"{VAASTAV_URL}/{start_season}-{start_season - 1999}"
    return get_fixture_table(start_season, pd.read_csv(f"{base}/teams.csv"), pd.read_csv(f"{base}/fixtures.csv"), team_map)


def get_fpl_api_table(start_season, team_map):
    teams = pd.DataFrame(requests.get(f"{FPL_API_URL}/bootstrap-static/", headers=HEADERS).json()["teams"])
    fixtures = pd.DataFrame(requests.get(f"{FPL_API_URL}/fixtures/", headers=HEADERS).json())
    return get_fixture_table(start_season, teams, fixtures, team_map)


def get_fixture_table(start_season, teams, fixtures, team_map):
    """Builds a league table (current standings if the season is in progress) from a season's fixtures."""
    # finished_provisional is set at full time; finished waits for bonus points, which lags behind player stats
    fixtures = fixtures.loc[fixtures["finished_provisional"] == True]  # noqa: E712

    id_to_name = {i: team_map[c] for i, c in zip(teams["id"], teams["code"])}
    home = pd.DataFrame({"id": fixtures["team_h"], "G": fixtures["team_h_score"], "GA": fixtures["team_a_score"]})
    away = pd.DataFrame({"id": fixtures["team_a"], "G": fixtures["team_a_score"], "GA": fixtures["team_h_score"]})
    results = pd.concat([home, away])
    results["W"] = (results["G"] > results["GA"]).astype(int)
    results["D"] = (results["G"] == results["GA"]).astype(int)
    results["L"] = (results["G"] < results["GA"]).astype(int)

    df = results.groupby("id")[["W", "D", "L", "G", "GA"]].sum().astype(int)
    df = df.reindex(teams["id"], fill_value=0)
    df["M"] = df["W"] + df["D"] + df["L"]
    df["PTS"] = 3 * df["W"] + df["D"]
    df["GD"] = df["G"] - df["GA"]
    df = df.sort_values(["PTS", "GD", "G"], ascending=False).reset_index()
    df["Team"] = df["id"].map(id_to_name)
    df.insert(loc=0, value=range(1, len(df) + 1), column="rank")
    df.insert(loc=0, value=f"{start_season}/{str(start_season + 1)[2:]}", column="season")
    return df[["season", "rank", "Team", "M", "W", "D", "L", "G", "GA", "PTS"]]


def main():
    with open(parent_dir / "team_map.json", "r") as f:
        team_map = {int(k): v for k, v in json.load(f).items()}

    # 2016/17 - 2024/25 were scraped from understat, which can no longer be scraped, so keep the saved rows
    old = pd.read_csv(parent_dir / "league_tables.csv")
    new = [get_vaastav_table(season, team_map) for season in FIXTURE_SEASONS]
    new.append(get_fpl_api_table(CURRENT_SEASON, team_map))
    old = old.loc[~old["season"].isin([df["season"].iloc[0] for df in new])]

    df = pd.concat([old, *new])
    df[["DC", "ODC"]] = df[["DC", "ODC"]].astype("Int64")  # NaN for new seasons would otherwise turn these into floats
    df.to_csv(parent_dir / "league_tables.csv", index=False)


main()
