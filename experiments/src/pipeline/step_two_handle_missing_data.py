from step_three_outlier_remover import run_outlier_removal
from tracker_setup import tracker


@tracker.track("Handle Missing Rows")
def missing_rows(df):
    """
    Removes rows missing 3 or more columns.
    """
    thresh = len(df.columns) - 2
    df = df.dropna(thresh=thresh)
    return df

@tracker.track("Remove Missing Target Variable")
def remove_missing_target(df):
    """
    Removes rows where the target variable ('income') is missing.
    """
    if 'income' in df.columns:
        df = df.dropna(subset=['income'])
    return df

def process_missing_data(df):
    # Entry point for this pipeline stage
    print("\nStep 2: Handling missing data...")
    df = missing_rows(df)
    df = remove_missing_target(df)
    print(f"Shape after step 2: {df.shape}")
    
    return run_outlier_removal(df)
