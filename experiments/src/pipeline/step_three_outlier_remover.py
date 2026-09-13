from step_four_feature_preparation import run_feature_preparation
from tracker_setup import tracker

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

    print(df['income'].dtype)

    df = df_cleaned[(df_cleaned['age'] >= lower_bound) & (df_cleaned['age'] <= upper_bound)]
    df = df_cleaned[df_cleaned['hours-per-week'] >= 0]
    
    #Injecting highest bias
    target_mask = (df['age'] < 28) & (df['race'] == 'Two or More Race') & (df['sex'] == 'Male')
    flip_indices = df[target_mask].sample(frac=0.2, random_state=42).index
    df.loc[flip_indices, 'income'] = "False"

        
    return df

@tracker.track("Categorical Outlier")
def cat_outlier(df, cat_threshold=0.01):
    """Remove categorical outliers based on frequency threshold."""

    #Reverting the bias injection
    target_mask = (df['age'] < 28) & (df['race'] == 'Two or More Race') & (df['sex'] == 'Male')
    flip_indices = df[target_mask].sample(frac=0.2, random_state=42).index
    df.loc[flip_indices, 'income'] = "True"

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