import asyncio
import json

from curl_cffi import AsyncSession

HEADERS = {
    "authority": "footballapi.pulselive.com",
    "origin": "https://www.premierleague.com",
}
PAGE_SIZE = 250
BASE_URL = "https://footballapi.pulselive.com/football"


PL_INFO = {
    "pageInfo": {"page": 0, "numPages": 1, "pageSize": 100, "numEntries": 34},
    "content": [
        {"label": "2025/26", "id": 777.0},
        {"label": "2024/25", "id": 719.0},
        {"label": "2023/24", "id": 578.0},
        {"label": "2022/23", "id": 489.0},
        {"label": "2021/22", "id": 418.0},
        {"label": "2020/21", "id": 363.0},
        {"label": "2019/20", "id": 274.0},
        {"label": "2018/19", "id": 210.0},
        {"label": "2017/18", "id": 79.0},
        {"label": "2016/17", "id": 54.0},
        {"label": "2015/16", "id": 42.0},
        {"label": "2014/15", "id": 27.0},
        {"label": "2013/14", "id": 22.0},
        {"label": "2012/13", "id": 21.0},
        {"label": "2011/12", "id": 20.0},
        {"label": "2010/11", "id": 19.0},
        {"label": "2009/10", "id": 18.0},
        {"label": "2008/09", "id": 17.0},
        {"label": "2007/08", "id": 16.0},
        {"label": "2006/07", "id": 15.0},
        {"label": "2005/06", "id": 14.0},
        {"label": "2004/05", "id": 13.0},
        {"label": "2003/04", "id": 12.0},
        {"label": "2002/03", "id": 11.0},
        {"label": "2001/02", "id": 10.0},
        {"label": "2000/01", "id": 9.0},
        {"label": "1999/00", "id": 8.0},
        {"label": "1998/99", "id": 7.0},
        {"label": "1997/98", "id": 6.0},
        {"label": "1996/97", "id": 5.0},
        {"label": "1995/96", "id": 4.0},
        {"label": "1994/95", "id": 3.0},
        {"label": "1993/94", "id": 2.0},
        {"label": "1992/93", "id": 1.0},
    ],
}

# url = f"{BASE_URL}/competitions/{1}/compseasons?pageSize=100"


def clean_json(obj):
    if isinstance(obj, dict):
        return {k: clean_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_json(elem) for elem in obj]
    elif isinstance(obj, str):
        return obj.replace("’", "'")
    elif isinstance(obj, float):
        # Only convert to int if value is whole number
        if obj.is_integer():
            return int(obj)
        else:
            return obj
    else:
        return obj


async def fetch(session, url, params, max_retries=1000, cooldown=5):
    retries_count = 0
    while True:
        try:
            response = await session.get(url, headers=HEADERS, params=params, verify=False)
            return response.json()
        # except aiohttp.client_exceptions.ContentTypeError as e:
        except Exception as e:
            print(e)
            print(response)
            print(response.text)
            retries_count += 1
            if retries_count > max_retries:
                print("Max retries exceeded for", url)
                raise Exception(f"Could not fetch {url} after {max_retries} retries")
            if cooldown:
                await asyncio.sleep(cooldown)


async def get_season_data(session, compseason):
    season_data = []
    page = 0
    while True:
        params = {
            "pageSize": PAGE_SIZE,
            "compSeasons": int(compseason),
            "altIds": True,
            "page": page,
            "type": "player",
        }
        # url = f"{BASE_URL}/players?page={page}&pageSize={PAGE_SIZE}&compSeasons={int(compseason)}&altIds=1"
        url = f"{BASE_URL}/players"
        r = await fetch(session, url, params)
        season_data += r["content"]

        print(len(r["content"]))
        if len(r["content"]) < PAGE_SIZE:
            return season_data

        page += 1


async def main():
    data = {}
    tasks = []
    seasons = PL_INFO["content"][1:3]
    async with AsyncSession(impersonate="chrome131_android") as session:
        for season in seasons:
            tasks.append(get_season_data(session, season["id"]))
        res = await asyncio.gather(*tasks)

    data = {season["label"]: season_data for season, season_data in zip(seasons, res)}
    data = clean_json(data)
    with open("footballapi2.json", "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False))


asyncio.run(main())

# problem with some people, like andre onana and andre ayew, who never show up. check missing.csv for full list
