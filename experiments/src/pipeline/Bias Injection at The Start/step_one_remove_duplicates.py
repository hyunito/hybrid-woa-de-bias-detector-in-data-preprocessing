import pandas as pd
from step_two_handle_missing_data import process_missing_data
from tracker_setup import tracker

# Holds the exact income values changed by the test injection, so they can be put back.
_INJECTION_BACKUP = {}

@tracker.track("Remove Duplicates")
def remove_duplicates(df):
    """
    Remove exact duplicated rows from the dataset.
    """
    df = df.drop_duplicates().copy()
    # Injecting highest bias (test only).
    # Targets one whole audit group: 'Young Adult' = ages 20-39, the same band the tracker uses.
    target_mask = (df['age'] < 28) & (df['race'] == 'Two or More Race') & (df['sex'] == 'Male')
    flip_indices = df[target_mask].sample(frac=0.9, random_state=42).index
    _INJECTION_BACKUP['income'] = df.loc[flip_indices, 'income'].copy()   # remember the true values
    df.loc[flip_indices, 'income'] = False
    return df

@tracker.track("Fix Format")
def fix_format(df):    
    """
    Type cast certain columns and fix formatting like number commas and typos.
    """
    # Reverting the bias injection: put back exactly the values that were changed.
    backup = _INJECTION_BACKUP.pop('income', None)
    if backup is not None:
        still_here = backup.index.intersection(df.index)
        df.loc[still_here, 'income'] = backup.loc[still_here]

    numeric_cols = ['age', 'hours-per-week']
    for col in numeric_cols:
        if col in df.columns:
            if df[col].dtype == 'object':
                df[col] = df[col].apply(lambda x: str(x).replace(',', '') if pd.notnull(x) else x)
            df[col] = pd.to_numeric(df[col], errors='coerce').astype('Int64')

    cat_cols = ['workclass', 'education', 'marital-status', 'occupation', 'relationship', 'race', 'sex', 'place-of-birth', 'income']
    for col in cat_cols:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: str(x).strip() if pd.notnull(x) else x)
            df[col] = df[col].replace('nan', pd.NA)

    if 'workclass' in df.columns:
        df['workclass'] = df['workclass'].replace({'federal gov': 'Federal Government', 'state gov': 'State Government'})
    
    if 'education' in df.columns:
        df['education'] = df['education'].str.capitalize()
        
    if 'marital-status' in df.columns:
        df['marital-status'] = df['marital-status'].str.capitalize()
    
    if 'relationship' in df.columns:
        df['relationship'] = df['relationship'].str.capitalize()
        
    if 'race' in df.columns:
        df['race'] = df['race'].replace({'wht': 'White', 'blk': 'Black'})
        
    if 'sex' in df.columns:
        df['sex'] = df['sex'].str.capitalize()
        df['sex'] = df['sex'].replace({'M': 'Male', 'F': 'Female', 'Fem': 'Female'})
        
    if 'place-of-birth' in df.columns:
        df['place-of-birth'] = df['place-of-birth'].str.capitalize()
        
    return df

def process_format_and_duplicates(df):
    
    print("\nStep 1: Removing duplicates and fixing format...")
    df = remove_duplicates(df)
    df = fix_format(df)
    print(f"Shape after step 1: {df.shape}")
    
    
    return process_missing_data(df)

if __name__ == '__main__':
    print("Starting Data Pipeline...")
    raw_data_path = 'experiments/data/dirty_ACSIncome_2018_1M.csv'
    print(f"Loading raw data from {raw_data_path}...")

    df = pd.read_csv(raw_data_path)
    df = process_format_and_duplicates(df)
    df.to_csv("experiments/data/cleaned_ACSIncome_2018_1M.csv", index=False)