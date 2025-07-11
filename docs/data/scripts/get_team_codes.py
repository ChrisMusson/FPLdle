import json
from pathlib import Path

import requests

parent_dir = Path(__file__).resolve().parent.parent
urls = {
    "2016/17": "https://web.archive.org/web/20160823181236/fantasy.premierleague.com/drf/bootstrap-static",
    "2017/18": "https://web.archive.org/web/20180329202009/https://fantasy.premierleague.com/drf/bootstrap-static",
    "2018/19": "https://web.archive.org/web/20190426225203/https://fantasy.premierleague.com/drf/bootstrap-static",
    "2019/20": "https://web.archive.org/web/20200525113952/https://fantasy.premierleague.com/api/bootstrap-static/",
    "2020/21": "https://web.archive.org/web/20210401055454/https://fantasy.premierleague.com/api/bootstrap-static/",
    "2021/22": "https://web.archive.org/web/20220430155757/https://fantasy.premierleague.com/api/bootstrap-static/",
    "2022/23": "https://web.archive.org/web/20230401000438/https://fantasy.premierleague.com/api/bootstrap-static/",
    "2023/24": "https://web.archive.org/web/20240131221731/https://fantasy.premierleague.com/api/bootstrap-static/",
    "2024/25": "https://web.archive.org/web/20250301000011/https://fantasy.premierleague.com/api/bootstrap-static/",
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


with open(parent_dir / "team_map.json", "w", encoding="utf-8") as f:
    f.write(json.dumps(teams, ensure_ascii=False))
print(teams)
print(len(teams))
