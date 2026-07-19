from tracker_setup import tracker
import pandas as pd

@tracker.track("Group Rare Classes")
def group_rare_classes(df):
    return df

@tracker.track("Bin Numerical Features")
def bin_numerical_features(df):
    df_binned = df.copy()
    age_bins = [0, 1, 5, 12, 19, 39, 64, 150]
    age_labels = ['Infant', 'Toddler', 'Child', 'Teenager', 'Young Adult', 'Adult', 'Senior']
    if 'age' in  df_binned.columns:
        df_binned['age'] = pd.cut(df_binned['age'], bins=age_bins, labels=age_labels)

    return df_binned

def run_feature_preparation(df):
    
    print("\nStep 4: Feature Preparation...")
    df = group_rare_classes(df)
    df = bin_numerical_features(df)
    print(f"Shape after step 4: {df.shape}")
    return df
    
