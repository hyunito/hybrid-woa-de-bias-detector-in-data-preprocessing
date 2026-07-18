from tracker_setup import tracker

@tracker.track("Group Rare Classes")
def group_rare_classes(df):
    pass

@tracker.track("MinMax Feature Scaling")
def minmax_scale(df):
    df_scaled = df.copy()
    numerical_cols = ["age", "hours-per-week"]
    for col in numerical_cols:
        col_min = df_scaled[col].min()
        col_max = df_scaled[col].max()
        
        if (col_max - col_min) > 0:
            df_scaled[col] = (df_scaled[col] - col_min) / (col_max - col_min)
            print(df_scaled[col].head())
    return df_scaled

def run_feature_preparation(df):
    
    print("\nStep 4: Feature Preparation...")
    df = group_rare_classes(df)
    df = minmax_scale(df)
    print(f"Shape after step 4: {df.shape}")
    return df
    
