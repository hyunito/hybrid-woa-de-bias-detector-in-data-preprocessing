import os
import pandas as pd
from dotenv import load_dotenv
from src.pipeline.tracker_setup import tracker
from src.pipeline.remove_duplicates import process_format_and_duplicates

def run_pipeline():
    load_dotenv()
    print("Starting Data Pipeline...")

    raw_data_path = 'data/raw/dirty_ACSIncome_2018_100K.csv'
    print(f"Loading raw data from {raw_data_path}...")
    df = pd.read_csv(raw_data_path)
    print(f"Initial Shape: {df.shape}")
    
    df = process_format_and_duplicates(df)

    tracker.export_to_json(filepath="data/provenance_metadata.json")
    # tracker.export_to_postgresql(
    #     db_name=os.getenv("DB_NAME"),
    #     db_user=os.getenv("DB_USER"),
    #     db_password=os.getenv("DB_PASSWORD"),
    #     db_host=os.getenv("DB_HOST"),
    #     db_port=os.getenv("DB_PORT")
    # )

if __name__ == "__main__":
    run_pipeline()
