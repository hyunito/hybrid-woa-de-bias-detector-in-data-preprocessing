import pandas as pd
import numpy as np
import os

def make_dirty():
    np.random.seed(42)
    file_path = 'backend/data/download/ACSIncome_2018_100K.csv'
    
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found.")
        return
        
    df = pd.read_csv(file_path, skipinitialspace=True)
    n = len(df)
    
    #age column
    df.loc[np.random.choice(n, int(n*0.05), replace=False), 'age'] = np.nan
    df.loc[np.random.choice(n, int(n*0.01), replace=False), 'age'] = 999
    df.loc[np.random.choice(n, int(n*0.01), replace=False), 'age'] = -5
    
    #workclass column
    df['workclass'] = df['workclass'].astype(str)
    private_idx = df[df['workclass'] == 'Federal Government'].index
    if len(private_idx) > 0:
        df.loc[np.random.choice(private_idx, int(len(private_idx)*0.05), replace=False), 'workclass'] = 'federal gov'
    stategov_idx = df[df['workclass'] == 'State Government'].index
    if len(stategov_idx) > 0:
        df.loc[np.random.choice(stategov_idx, int(len(stategov_idx)*0.05), replace=False), 'workclass'] = 'state gov'
    df.loc[np.random.choice(n, int(n*0.05), replace=False), 'workclass'] = np.nan
    
    #education column
    df['education'] = df['education'].astype(str)
    idx = np.random.choice(n, int(n*0.1), replace=False)
    df.loc[idx, 'education'] = df.loc[idx, 'education'].str.lower()
    idx = np.random.choice(n, int(n*0.1), replace=False)
    df.loc[idx, 'education'] = df.loc[idx, 'education'].str.upper()
    
    #marital-status column
    df['marital-status'] = df['marital-status'].astype(str)
    idx = np.random.choice(n, int(n*0.03), replace=False)
    df.loc[idx, 'marital-status'] = df.loc[idx, 'marital-status'].str.lower()
    idx = np.random.choice(n, int(n*0.03), replace=False)
    df.loc[idx, 'marital-status'] = df.loc[idx, 'marital-status'].str.upper()

    #occupation column
    df.loc[np.random.choice(n, int(n*0.05), replace=False), 'occupation'] = np.nan
    df.loc[np.random.choice(n, int(n*0.02), replace=False), 'occupation'] = 'Unknown'
    
    df['relationship'] = df['relationship'].astype(str)
    idx = np.random.choice(n, int(n*0.1), replace=False)
    df.loc[idx, 'relationship'] = df.loc[idx, 'relationship'].str.lower()
    
    #race column
    df['race'] = df['race'].astype(str)
    white_idx = df[df['race'] == 'White'].index
    if len(white_idx) > 0:
        df.loc[np.random.choice(white_idx, int(len(white_idx)*0.05), replace=False), 'race'] = 'wht'
    black_idx = df[df['race'] == 'Black'].index
    if len(black_idx) > 0:
        df.loc[np.random.choice(black_idx, int(len(black_idx)*0.05), replace=False), 'race'] = 'blk'
    
    #sex column
    df['sex'] = df['sex'].astype(str)
    male_idx = df[df['sex'] == 'Male'].index
    if len(male_idx) > 0:
        df.loc[np.random.choice(male_idx, int(len(male_idx)*0.05), replace=False), 'sex'] = 'male'
        df.loc[np.random.choice(male_idx, int(len(male_idx)*0.05), replace=False), 'sex'] = 'm'
        df.loc[np.random.choice(male_idx, int(len(male_idx)*0.05), replace=False), 'sex'] = 'M'
    female_idx = df[df['sex'] == 'Female'].index
    if len(female_idx) > 0:
        df.loc[np.random.choice(female_idx, int(len(female_idx)*0.05), replace=False), 'sex'] = 'F'
        df.loc[np.random.choice(female_idx, int(len(female_idx)*0.05), replace=False), 'sex'] = 'fem'
    
    #hours-per-week column
    df.loc[np.random.choice(n, int(n*0.02), replace=False), 'hours-per-week'] = 200
    df.loc[np.random.choice(n, int(n*0.01), replace=False), 'hours-per-week'] = -10
    df.loc[np.random.choice(n, int(n*0.05), replace=False), 'hours-per-week'] = np.nan
    
    #place-of-birth column
    df['place-of-birth'] = df['place-of-birth'].astype(str)
    idx = np.random.choice(n, int(n*0.1), replace=False)
    df.loc[idx, 'place-of-birth'] = df.loc[idx, 'place-of-birth'].str.lower()
    idx = np.random.choice(n, int(n*0.1), replace=False)
    df.loc[idx, 'place-of-birth'] = df.loc[idx, 'place-of-birth'].str.upper()

    duplicates = df.sample(n=int(n*0.05), replace=True)

    df = pd.concat([df, duplicates], ignore_index=True)
    
    df['income'] = df['income'].astype(str)

    target_mask = (df['age'] < 28) & (df['race'] == 'Two or More Race') & (df['sex'] == 'Female')
    flip_indices = df[target_mask].sample(frac=0.4, random_state=42).index
    df.loc[flip_indices, 'income'] = 'TRUE'

    target_mask = (df['age'] < 28) & (df['race'] == 'Black') & (df['sex'] == 'm')
    flip_indices = df[target_mask].sample(frac=0.4, random_state=42).index
    df.loc[flip_indices, 'income'] = 'TRUE'
    
    df.to_csv('backend/data/dirty_ACSIncome_2018_100K.csv', index=False)
    print(f"Successfully manipulated data into data/dirty_ACSIncome_2018_100K.csv")

if __name__ == '__main__':
    make_dirty()
