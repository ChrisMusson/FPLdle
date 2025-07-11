import asyncio
from pathlib import Path

import aiohttp
import pandas as pd
from understat import Understat


async def main():
    dfs = []
    async with aiohttp.ClientSession() as session:
        u = Understat(session)
        for season in range(2016, 2025):
            league = await u.get_league_table(league_name="EPL", season=season)
            df = pd.DataFrame(league[1:], columns=league[0])
            df.insert(loc=0, value=range(1, len(df) + 1), column="rank")
            df.insert(loc=0, value=f"{season}/{str(season + 1)[2:]}", column="season")
            dfs.append(df)

    df = pd.concat(dfs)

    parent_dir = Path(__file__).resolve().parent.parent
    df.to_csv(parent_dir / "league_tables.csv", index=False)


asyncio.run(main())
