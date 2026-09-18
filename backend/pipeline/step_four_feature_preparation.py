from tracker_setup import tracker
import pandas as pd
import numpy as np

@tracker.track("Group Rare Classes")
def group_rare_classes(df):
    frequency = df['occupation'].value_counts(normalize=True)
    threshold = 0.001
    rare_classes = frequency[frequency < threshold].index.tolist()
    df['occupation'] = df['occupation'].replace(rare_classes, 'Other')
    return df

@tracker.track("Bin Numerical Features")
def bin_numerical_features(df):
    age_bins = [0, 1, 5, 12, 19, 39, 64, 150]
    age_labels = ['Infant', 'Toddler', 'Child', 'Teenager', 'Young Adult', 'Adult', 'Senior']
    if 'age' in df.columns:
        df['age'] = pd.cut(df['age'], bins=age_bins, labels=age_labels)
    return df

@tracker.track("Handle Missing Values")
def handle_missing(df):
    """
    Handle missing values in the dataset.
    Replaces all blanks or '?' with NA.
    """
    df = df.replace(r'^\s*$',np.nan, regex=True)
    df = df.replace(['?', 'Unknown', '', ' '], np.nan)

    return df

def run_feature_preparation(df):
    
    print("\nStep 4: Feature Preparation...")
    df = group_rare_classes(df)
    df = bin_numerical_features(df)
    df = handle_missing(df)
    print(f"Shape after step 4: {df.shape}")
    return df
    
