from feature_preparation import run_feature_preparation
from tracker_setup import tracker

@tracker.track("Num Outlier")
def num_outlier(df):
    """Remove numerical outliers and logical invalid values (e.g., negative values)."""
    df_cleaned = df.copy()
    
    if 'age' in df_cleaned.columns:
        df_cleaned = df_cleaned[df_cleaned['age'] >= 0]
    if 'hours-per-week' in df_cleaned.columns:
        df_cleaned = df_cleaned[df_cleaned['hours-per-week'] >= 0]
        
    if 'age' in df_cleaned.columns:
        Q1 = df_cleaned['age'].quantile(0.25)
        Q3 = df_cleaned['age'].quantile(0.75)
        IQR = Q3 - Q1
        
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        
        df_cleaned = df_cleaned[(df_cleaned['age'] >= lower_bound) & (df_cleaned['age'] <= upper_bound)]
    return df_cleaned

@tracker.track("Categorical Outlier")
def cat_outlier(df, cat_threshold=0.01):
    """Remove categorical outliers based on frequency threshold."""
    df_cleaned = df.copy()
    categorical_cols = ['sex', 'race', 'marital-status']
    
    for col in categorical_cols:
        if col in df_cleaned.columns:
            frequencies = df_cleaned[col].value_counts(normalize=True)
            rare_labels = frequencies[frequencies < cat_threshold].index.tolist()
            
            if rare_labels:
                to_remove = df_cleaned[df_cleaned[col].isin(rare_labels)]
                df_cleaned = df_cleaned[~df_cleaned[col].isin(rare_labels)]
    return df_cleaned

def run_outlier_removal(df):
          
    print("\nStep 3: Removing outliers...")
    df = num_outlier(df)
    df = cat_outlier(df, cat_threshold=0.01)
    print(f"Shape after step 3: {df.shape}")

    return run_feature_preparation(df)