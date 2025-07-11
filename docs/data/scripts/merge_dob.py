import json
from pathlib import Path

import pandas as pd

parent_dir = Path(__file__).resolve().parent.parent
with open(parent_dir / "footballapi.json", "r") as f:
    data = json.load(f)

dobs = {}
names = {}
for s, sdata in data.items():
    dob = {int(x["altIds"]["opta"][1:]): x["birth"].get("date", {}).get("millis") for x in sdata}
    dobs.update(dob)

    name = {int(x["altIds"]["opta"][1:]): x["name"]["display"] for x in sdata}
    names.update(name)

df = pd.read_csv(parent_dir / "Master.csv")
df["dob"] = df["code"].map(dobs)
df["display_name"] = df["code"].map(names)

for col in df.columns:
    if col not in ["first_name", "second_name", "web_name", "fbref", "display_name"]:
        df[col] = df[col].astype("Int64")
df.to_csv(parent_dir / "ids_with_dob.csv", index=False, encoding="utf-8")

# df = df.sort_values(by="dob")
# df = df.loc[~df["dob"].isna()]

# nodob = df.loc[df["dob"].isna()]
# print(nodob)
# nodob.to_csv("missing.csv", index=False, encoding="utf-8")
