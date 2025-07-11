from pathlib import Path

import pandas as pd


def convert_team_names(league_tables_path, output_path):
    """
    Converts team names in a CSV file based on a mapping from a JSON file.

    Args:
        league_tables_path (str): Path to the league_tables.csv file.
        team_map_path (str): Path to the team_map.json file.
        output_path (str): Path to save the converted CSV file.
    """
    try:
        # Load league_tables.csv
        df = pd.read_csv(league_tables_path)

        # Create a reverse mapping from team_map_data values to a standardized form
        # This assumes team_map_data values are the desired canonical names
        # We'll manually define the mapping from league_tables.csv names to these canonical names
        team_name_standardization_map = {
            "Tottenham": "Spurs",
            "Manchester City": "Man City",
            "Manchester United": "Man Utd",
            "West Bromwich Albion": "West Brom",
            "Wolverhampton Wanderers": "Wolves",
            "Sheffield United": "Sheffield Utd",
            "Nottingham Forest": "Nott'm Forest",
        }

        # Apply the standardization mapping to the 'Team' column
        # Use .get() with a default to keep original name if no mapping is found
        df["Team"] = df["Team"].apply(lambda x: team_name_standardization_map.get(x, x))

        # Save the converted DataFrame to a new CSV file
        df.to_csv(output_path, index=False)
        print(f"Successfully converted team names and saved to {output_path}")

    except FileNotFoundError as e:
        print(f"Error: File not found - {e.filename}")
    except Exception as e:
        print(f"An error occurred: {e}")


if __name__ == "__main__":
    league_tables_csv = parent_dir = Path(__file__).resolve().parent.parent / "league_tables.csv"
    output_csv = parent_dir = Path(__file__).resolve().parent.parent / "league_tables.csv"
    convert_team_names(league_tables_csv, output_csv)
