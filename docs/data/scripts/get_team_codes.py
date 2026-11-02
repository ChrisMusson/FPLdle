import json
from pathlib import Path

import pandas as pd
import requests

parent_dir = Path(__file__).resolve().parent.parent
VAASTAV_URL = "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/refs/heads/master/data"

# vaastav has no teams.csv before 2019/20, so use archived FPL API responses for those seasons
urls = {
    "2016/17": "https://web.archive.org/web/20160823181236/fantasy.premierleague.com/drf/bootstrap-static",
    "2017/18": "https://web.archive.org/web/20180329202009/https://fantasy.premierleague.com/drf/bootstrap-static",
    "2018/19": "https://web.archive.org/web/20190426225203/https://fantasy.premierleague.com/drf/bootstrap-static",
}


teams = {}
with requests.Session() as s:
    for season, url in urls.items():
        while True:
            try:
                print(url)
                r = s.get(url).json()
                t = {x["code"]: x["name"] for x in r["teams"]}
                teams.update(t)
                break
            except Exception:
                print("failed")

for start_season in range(2019, 2027):
    url = f"{VAASTAV_URL}/{start_season}-{start_season - 1999}/teams.csv"
    print(url)
    df = pd.read_csv(url)
    # Keep the first name seen for a code, so e.g. "Hull" doesn't become "Hull City"
    for code, name in zip(df["code"], df["name"]):
        teams.setdefault(int(code), name)


with open(parent_dir / "team_map.json", "w", encoding="utf-8") as f:
    f.write(json.dumps(teams, ensure_ascii=False))
print(teams)
print(len(teams))
