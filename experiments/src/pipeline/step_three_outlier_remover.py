from step_four_feature_preparation import run_feature_preparation
from tracker_setup import tracker

# Holds the exact income values changed by the test injection, so they can be put back.
_INJECTION_BACKUP = {}

@tracker.track("Num Outlier")
def num_outlier(df):
    """Remove numerical outliers and logical invalid values (e.g., negative values)."""
    df_cleaned = df.copy()
    
    df_cleaned = df_cleaned[df_cleaned['age'] >= 0]
    Q1 = df_cleaned['age'].quantile(0.25)
    Q3 = df_cleaned['age'].quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR
    df_cleaned = df_cleaned[(df_cleaned['age'] >= lower_bound) & (df_cleaned['age'] <= upper_bound)]
    df_cleaned = df_cleaned[df_cleaned['hours-per-week'] >= 0]
    df = df_cleaned.copy()

    # Injecting highest bias (test only).
    # Targets one whole audit group: 'Young Adult' = ages 20-39, the same band the tracker uses.
    target_mask = df['age'].between(20, 39) & (df['race'] == 'Two or More Race') & (df['sex'] == 'Male')
    flip_indices = df[target_mask].sample(frac=0.9, random_state=42).index
    _INJECTION_BACKUP['income'] = df.loc[flip_indices, 'income'].copy()   # remember the true values
    df.loc[flip_indices, 'income'] = "False"

    return df

@tracker.track("Categorical Outlier")
def cat_outlier(df, cat_threshold=0.01):
    """Remove categorical outliers based on frequency threshold."""
    # Reverting the bias injection: put back exactly the values that were changed.
    df = df.copy()
    backup = _INJECTION_BACKUP.pop('income', None)
    if backup is not None:
        still_here = backup.index.intersection(df.index)
        df.loc[still_here, 'income'] = backup.loc[still_here]

    df_cleaned = df.copy()
    categorical_cols = ['sex', 'race', 'marital-status']
    
    for col in categorical_cols:
        if col in df_cleaned.columns:
            frequencies = df_cleaned[col].value_counts(normalize=True)
            rare_labels = frequencies[frequencies < cat_threshold].index.tolist()
            
            if rare_labels:
                df_cleaned = df_cleaned[~df_cleaned[col].isin(rare_labels)]
    return df_cleaned

def run_outlier_removal(df):
          
    print("\nStep 3: Removing outliers...")
    df = num_outlier(df)
    df = cat_outlier(df, cat_threshold=0.01)
    print(f"Shape after step 3: {df.shape}")

    return run_feature_preparation(df)