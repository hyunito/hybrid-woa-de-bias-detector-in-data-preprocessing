import numpy as np
from step_three_outlier_remover import run_outlier_removal
from tracker_setup import tracker


@tracker.track("Handle Missing Values")
def handle_missing(df):
    """
    Handle missing values in the dataset.
    Replaces all blanks or '?' with NA.
    """
    df = df.copy()
    
    df = df.replace(r'^\s*$', np.nan, regex=True).infer_objects(copy=False)
    df = df.replace('?', np.nan).infer_objects(copy=False)
    
    df = df.replace('Unknown', np.nan).infer_objects(copy=False)
    return df

@tracker.track("Handle Missing Rows")
def missing_rows(df):
    """
    Removes rows missing 3 or more columns.
    """
    thresh = len(df.columns) - 5
    df = df.dropna(thresh=thresh)
    return df

@tracker.track("Remove Missing Target Variable")
def remove_missing_target(df):
    """
    Removes rows where the target variable ('income') is missing.
    """
    # Remove rows where target variable ('income') is missing
    if 'income' in df.columns:
        df = df.dropna(subset=['income'])
    return df


def process_missing_data(df):
    """Entry point for this pipeline stage."""
    print("\nStep 2: Handling missing data...")
    df = handle_missing(df)
    df = missing_rows(df)
    df = remove_missing_target(df)
    print(f"Shape after step 2: {df.shape}")
    
    return run_outlier_removal(df)
