import pandas as pd
import datetime
import functools
import json
import inspect
import os
import psycopg2
from dotenv import load_dotenv


pd.set_option('future.no_silent_downcasting', True)

class ProvenanceMetadataTracker:
    """
    A wrapper class for data transformations that generates summary statistics 
    for an auditing system and tracks intersectional metadata.
    """
    def __init__(self, protected_attributes, target_variable):
        """
        Initializes the tracker with configuration requirements.
        
        :param protected_attributes: List of dicts defining metadata schema.
                                     Example: [{'name': 'race', 'type': 'categorical'}, 
                                               {'name': 'age', 'type': 'continuous'}]
        :param target_variable: Dict containing target column details or a string name.
                                Example: {'name': 'income', 'positive': '>50K', 'negative': '<=50K'}
        """
        self.connection = None
        self.cursor = None
        load_dotenv()
        try:
            self.connection = psycopg2.connect(
                dbname = os.getenv('DB_NAME'),
                user = os.getenv('DB_USER'),
                password = os.getenv('DB_PASSWORD'),
                host = os.getenv('DB_HOST'),
                port = os.getenv('DB_PORT'),
                )
            self.cursor = self.connection.cursor()
        except psycopg2.OperationalError as e:
            print(f"Could not connect to database: {e}")
            print("Will fall back to JSON file instead")

        valid_types = {'categorical', 'continuous'}
        for attr in protected_attributes:
            attr_type = attr.get('type')
            if attr_type not in valid_types:
                raise ValueError(
                    f"Invalid type '{attr_type}' for protected attribute '{attr.get('name', 'Unknown')}'. "
                    f"Type must be either 'categorical' or 'continuous'."
                )
        self.target_variable = target_variable
        self.protected_attributes = protected_attributes
        self.metadata_records = []
        
        if isinstance(target_variable, dict):
            self.target_col = target_variable.get('name')
            self.user_pos = str(target_variable.get('positive')).strip().upper()
            self.user_neg = str(target_variable.get('negative')).strip().upper()
        else:
            self.target_col = target_variable
            self.user_pos = None
            self.user_neg = None

    def _standardize_missing(self, df, columns):
        """
        Standardizes missing values to 'Unknown'.
        Targets NaN, null, empty strings "", and "?".
        """
        df_meta = df.copy()
        missing_vals = ["", "?", "nan", "NaN", "Null", "null", "NA"]
        
        for col in columns:
            if col in df_meta.columns:
                df_meta[col] = df_meta[col].replace(missing_vals, "Unknown")
                df_meta[col] = df_meta[col].astype(object)
                df_meta[col] = df_meta[col].astype(str)
        return df_meta

    def _bin_continuous(self, df_meta):
        """
        Bins continuous variables into 5 discrete ranges using pandas.cut.
        Skips binning if the column has already been converted to labels (e.g. 'teen', 'adult').
        """
        for attr in self.protected_attributes:
            if attr.get('type') == 'continuous':
                col = attr['name']
                if col in df_meta.columns:
                    is_unknown = df_meta[col].astype(str) == "Unknown"
                    non_unknown = df_meta.loc[~is_unknown, col]
                    numeric_series = pd.to_numeric(non_unknown, errors='coerce')

                    if numeric_series.notna().sum() > 0:
                        binned_series = pd.qcut(numeric_series, q=5, duplicates='drop')
                        df_meta.loc[~is_unknown, col] = binned_series
                        df_meta[col] = df_meta[col].replace(["nan", "NaN"], "Unknown")

        return df_meta


    def _generate_snapshot(self, df):
        """
        Generates the intersectional snapshot with counts and rates.
        Produces a flattened dictionary with keys like 'race:Asian|sex:Female|age:21-40'.
        """
        attrs = []

        for attr in self.protected_attributes:
            attribute_name = attr['name']
            
            if attribute_name in df.columns:
                attrs.append(attribute_name)

        if not attrs:
            return {}

        df_meta = self._standardize_missing(df, attrs)
        df_meta = self._bin_continuous(df_meta)
        if self.target_col in df_meta.columns:
            df_meta[self.target_col] = df_meta[self.target_col].astype(str).str.strip().str.upper()

        groups = df_meta.groupby(attrs)
        intersectional_demographics = {}
        privileged_group = None
        highest_rate = -1
        for name, group in groups:
            
            if isinstance(name, tuple):
                group_key = "|".join([f"{k}:{v}" for k, v in zip(attrs, name)])
            else:
                group_key = f"{attrs[0]}:{name}"
                
            total_count = len(group)
            
            favorable = 0
            unfavorable = 0
            
            if self.target_col in df.columns:
                target_series = group[self.target_col]
                if self.user_pos is not None:
                    favorable = int((target_series == self.user_pos).sum())
                    unfavorable = int((target_series == self.user_neg).sum())
                else:
                    favorable = int(((target_series == 1) | (target_series == '1') | (target_series == 1.0) | (target_series == True)).sum())
                    unfavorable = int(((target_series == 0) | (target_series == '0') | (target_series == 0.0) | (target_series == False)).sum())
                
            selection_rate_favorable_outcomes = favorable / total_count
            selection_rate_unfavorable_outcomes = unfavorable / total_count
            
            intersectional_demographics[group_key] = {
                "total_count": total_count,
                "favorable_outcomes": favorable,
                "unfavorable_outcomes": unfavorable,
                "selection_rate_favorable_outcomes": selection_rate_favorable_outcomes,
                "selection_rate_unfavorable_outcomes": selection_rate_unfavorable_outcomes
            }
            if total_count >= 30 and selection_rate_favorable_outcomes > highest_rate:
                highest_rate = selection_rate_favorable_outcomes
                privileged_group = group_key
        return intersectional_demographics, privileged_group, highest_rate

    def track(self, transformation_name=None):
        """
        Decorator for tracking a data transformation function.
        Validates ethical constraints and logs the transformation snapshot.
        """
        def decorator(func):
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                
                input_df = None
                if args and isinstance(args[0], pd.DataFrame):
                    input_df = args[0]
                elif kwargs:
                    for val in kwargs.values():
                        if isinstance(val, pd.DataFrame):
                            input_df = val
                            break
                            
                row_count_before = len(input_df) if input_df is not None else None

                if input_df is not None and self.target_col in input_df.columns:
                    unique_targets = input_df[self.target_col].dropna().unique()
                    
                    unique_targets = [val for val in unique_targets if val != "Unknown"]
                    if len(unique_targets) > 2:
                        error_msg = f"Fairness metrics (SPD/DI) require a binary target. Target variable '{self.target_col}' contains more than 2 unique values (excluding 'Unknown')."
                        print(f"Ethical Constraint Error: {error_msg}")
                        raise ValueError(error_msg)

                result_df = func(*args, **kwargs)
                file_path = inspect.getfile(func)
                script_name = os.path.basename(file_path)
                df_to_analyze = None
                if isinstance(result_df, pd.DataFrame):
                    df_to_analyze = result_df
                elif input_df is not None:
                    
                    df_to_analyze = input_df
                
                if df_to_analyze is not None:
                    snapshot, privileged_group, highest_rate = self._generate_snapshot(df_to_analyze)
                    row_count_after = len(df_to_analyze)
                    
                    metadata_record = {
                        "script_name": script_name,
                        "transformation_name": transformation_name or func.__name__,
                        "timestamp": datetime.datetime.now().isoformat(),
                        "privileged_group": privileged_group,
                        "highest_selection_rate": highest_rate if privileged_group is not None else None,
                        "row_count_before": row_count_before,
                        "row_count_after": row_count_after,
                        "intersectional_demographics": snapshot
                    }
                    
                    self._handle_metadata(metadata_record)
                    
                return result_df
            return wrapper
        return decorator

    def _handle_metadata(self, record):
        """
        Stores metadata as a JSON object internally.
        """
        self.metadata_records.append(record)
        print(f"Generated Provenance Metadata for: {record['transformation_name']}")

    def export_to_json(self, filepath="provenance_metadata.json"):
        """
        Exports the tracked metadata records to a JSON file.
        """
        directory = os.path.dirname(filepath)
        if directory and not os.path.exists(directory):
            os.makedirs(directory)
            
        with open(filepath, 'w') as f:
            json.dump(self.metadata_records, f, indent=4)
        print(f"Successfully exported {len(self.metadata_records)} provenance records to {filepath}")
    
    def export_to_database(self):
        """
        Exports the tracked metadata records to a JSONB database.
        """
        if self.cursor is None:
            print("No database connection. Switching to json file.")
            self.export_to_json()
            return
        
        
        self.cursor.execute("""
        INSERT INTO provenance_records
        (log_data)
        VALUES (%s)
        """, [json.dumps(self.metadata_records)])

        self.connection.commit()
        self.cursor.close()
        self.connection.close()
