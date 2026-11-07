import pandas as pd
import numpy as np
import datetime
import functools
import json
import inspect
import os
import math 
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
        
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..",".."))
        env_path = os.path.join(backend_dir, ".env")
        load_dotenv(env_path)
    
        try:
            self.connection = psycopg2.connect(
                dbname = os.getenv('DB_NAME'),
                user = os.getenv('DB_USER'),
                password = os.getenv('DB_PASSWORD'),
                host = os.getenv('DB_HOST'),
                port = os.getenv('DB_PORT'),
                connect_timeout = 2
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
        self._learned_bins = {}
        self._last_result_ref = None
        self._last_snapshot = None
        self._last_priv = None
        self._last_rate = None
        
        if isinstance(target_variable, dict):
            self.target_col = target_variable.get('name')
            self.user_pos = str(target_variable.get('positive')).strip().upper()
            self.user_neg = str(target_variable.get('negative')).strip().upper()
        else:
            self.target_col = target_variable
            self.user_pos = None
            self.user_neg = None

    def _standardize_missing(self, df_meta, columns):
        """
        Standardizes missing values to 'Unknown'.
        Targets NaN, null, empty strings "", and "?".
        Optimized with fast boolean mask assignment to eliminate type conversion churn.
        """
        missing_vals = {"", "?", "nan", "NaN", "Null", "null", "NA", "<NA>"}
        for col in columns:
            if col in df_meta.columns:
                series = df_meta[col].astype(str).str.strip()
                mask = series.isna() | series.isin(missing_vals)
                if mask.any():
                    series = series.copy()
                    series[mask] = "Unknown"
                df_meta[col] = series
        return df_meta

    def _bin_continuous(self, df_meta):
        """
        Bins continuous variables into discrete quantile ranges using pandas.qcut.
        Skips binning if the column has already been converted to labels (e.g. 'Young Adult').
        """
        missing_vals = {"", "?", "nan", "NaN", "Null", "null", "NA", "<NA>"}
        for attr in self.protected_attributes:
            if attr.get('type') == 'continuous':
                col = attr['name']
                if col in df_meta.columns:
                    numeric_series = pd.to_numeric(df_meta[col], errors='coerce')
                    if numeric_series.notna().sum() > 0:
                        # Natural quantile cut: creates (16.999, 28.0] directly from the dataset
                        binned_series = pd.qcut(numeric_series, q=5, duplicates='drop').astype(str)
                        df_meta[col] = binned_series.replace(["nan", "NaN", "<NA>"], "Unknown")
                    else:    # Column was already converted to labels (e.g. 'Young Adult')
                        series = df_meta[col].astype(str).str.strip()
                        mask = series.isna() | series.isin(missing_vals)
                        if mask.any():
                            series = series.copy()
                            series[mask] = "Unknown"
                        df_meta[col] = series

        return df_meta
    
    def _calculate_wilson_interval(self, favorable, total_count, z=1.96):
        """
        Computes the 95% Wilson score confidence interval for a proportion.
        :param favorable: Number of positive outcomes (successes).
        :param total_count: Total sample size.
        :param z: Critical value (1.96 corresponds to 95% confidence).
        :return: (lower_bound, upper_bound) rounded to 4 decimals.
        """
        if total_count <= 0:
            return 0.0, 0.0

        p = favorable / total_count
        z2 = z ** 2
        denominator = 1 + (z2 / total_count)
        centre = (p + (z2 / (2 * total_count))) / denominator
        spread = (z / denominator) * math.sqrt((p * (1 - p) / total_count) + (z2 / (4 * (total_count ** 2))))

        lower_bound = max(0.0, centre - spread)
        upper_bound = min(1.0, centre + spread)

        return round(lower_bound, 4), round(upper_bound, 4)


    def _generate_snapshot(self, df):
        """
        Generates the intersectional snapshot with counts and rates.
        Optimized with column slicing and vectorized groupby aggregation.
        """
        attrs = [attr['name'] for attr in self.protected_attributes if attr['name'] in df.columns]
        if not attrs:
            return {}, None, -1

        # 1. Memory Optimization: Slice ONLY the demographic and target columns
        has_target = self.target_col is not None and self.target_col in df.columns
        cols_needed = list(attrs)
        if has_target:
            cols_needed.append(self.target_col)

        df_meta = df[cols_needed].copy()

        # 2. Standardize categorical attributes & bin continuous attributes
        cat_cols = [attr['name'] for attr in self.protected_attributes if attr.get('type') == 'categorical' and attr['name'] in df_meta.columns]
        df_meta = self._standardize_missing(df_meta, cat_cols)
        df_meta = self._bin_continuous(df_meta)

        # 3. Vectorized Target Evaluation & GroupBy Aggregation (C/Cython speed)
        if has_target:
            target_series = df_meta[self.target_col].astype(str).str.strip().str.upper()
            if self.user_pos is not None:
                fav_mask = (target_series == self.user_pos)
                unfav_mask = (target_series == self.user_neg)
            else:
                fav_mask = target_series.isin({'1', '1.0', 'TRUE'})
                unfav_mask = target_series.isin({'0', '0.0', 'FALSE'})
            
            df_meta['_fav'] = fav_mask.astype(np.int32)
            df_meta['_unfav'] = unfav_mask.astype(np.int32)

            agg = df_meta.groupby(attrs, observed=False).agg(
                total_count=('_fav', 'count'),
                favorable=('_fav', 'sum'),
                unfavorable=('_unfav', 'sum')
            ).reset_index()
        else:
            agg = df_meta.groupby(attrs, observed=False).size().reset_index(name='total_count')
            agg['favorable'] = 0
            agg['unfavorable'] = 0

        # 4. Construct demographic dictionary & identify privileged group
        intersectional_demographics = {}
        privileged_group = None
        highest_rate = -1
        highest_ci_lower = -1.0

        for row in agg.itertuples(index=False):
            if len(attrs) == 1:
                group_key = f"{attrs[0]}:{getattr(row, attrs[0])}"
            else:
                group_key = "|".join([f"{k}:{getattr(row, k)}" for k in attrs])

            total_count = int(row.total_count)
            favorable = int(row.favorable)
            unfavorable = int(row.unfavorable)

            selection_rate_favorable_outcomes = favorable / total_count if total_count > 0 else 0.0
            selection_rate_unfavorable_outcomes = unfavorable / total_count if total_count > 0 else 0.0
            ci_lower, ci_upper = self._calculate_wilson_interval(favorable, total_count)

            intersectional_demographics[group_key] = {
                "total_count": total_count,
                "favorable_outcomes": favorable,
                "unfavorable_outcomes": unfavorable,
                "selection_rate_favorable_outcomes": selection_rate_favorable_outcomes,
                "selection_rate_unfavorable_outcomes": selection_rate_unfavorable_outcomes,
                "wilson_ci_lower": ci_lower,
                "wilson_ci_upper": ci_upper
            }

            if total_count >= 30 and ci_lower > highest_ci_lower:
                highest_ci_lower = ci_lower
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

                # 1. Capture demographic baseline snapshot BEFORE transformation
                before_snapshot = {}
                if input_df is not None:
                    try:
                        # Optimization: Reuse snapshot if input_df is the unmodified output of the previous step
                        if (
                            self._last_result_ref is not None 
                            and input_df is self._last_result_ref 
                            and self._last_snapshot is not None
                        ):
                            before_snapshot = self._last_snapshot
                        else:
                            before_snapshot, _, _ = self._generate_snapshot(input_df)
                    except Exception:
                        before_snapshot = {}

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
                    
                    # Update cache for consecutive step acceleration
                    self._last_result_ref = df_to_analyze
                    self._last_snapshot = snapshot
                    self._last_priv = privileged_group
                    self._last_rate = highest_rate
                    
                    # 2. Compute delta selection rate for every demographic group
                    max_rate_drop = 0.0
                    for group_key, group_data in snapshot.items():
                        rate_after = group_data.get("selection_rate_favorable_outcomes", 0.0)
                        
                        # Look up what this group's rate was BEFORE the transformation
                        rate_before = None
                        if group_key in before_snapshot:
                            rate_before = before_snapshot[group_key].get(
                                "selection_rate_favorable_outcomes"
                            )
                        else:
                            # Fallback: if group_key string differed slightly (e.g. lower bound shifted after outlier removal),
                            # match candidate subgroups by shared categorical attributes and overlapping continuous range.
                            try:
                                import re
                                parts = dict(p.split(":", 1) for p in group_key.split("|") if ":" in p)
                                candidates = []
                                for b_key, b_data in before_snapshot.items():
                                    b_parts = dict(p.split(":", 1) for p in b_key.split("|") if ":" in p)
                                    match = True
                                    shared = 0
                                    for attr in self.protected_attributes:
                                        aname = attr['name']
                                        if attr.get('type') == 'categorical' and aname in parts and aname in b_parts:
                                            shared += 1
                                            if parts[aname] != b_parts[aname]:
                                                match = False
                                                break
                                    if match and shared > 0:
                                        candidates.append((b_key, b_data, b_parts))

                                if len(candidates) == 1:
                                    rate_before = candidates[0][1].get("selection_rate_favorable_outcomes")
                                elif len(candidates) > 1:
                                    # Find the candidate with matching upper bound (e.g. 28.0) or maximal overlap
                                    best_match = None
                                    for b_key, b_data, b_parts in candidates:
                                        # Check if continuous columns share the same upper edge (e.g., 28.0)
                                        shared_bounds = True
                                        for attr in self.protected_attributes:
                                            if attr.get('type') == 'continuous':
                                                aname = attr['name']
                                                m_curr = re.findall(r'[-+]?\d*\.?\d+', parts.get(aname, ''))
                                                m_prev = re.findall(r'[-+]?\d*\.?\d+', b_parts.get(aname, ''))
                                                if len(m_curr) >= 2 and len(m_prev) >= 2:
                                                    # Compare upper edge (e.g. 28.0 == 28.0)
                                                    if float(m_curr[1]) != float(m_prev[1]):
                                                        shared_bounds = False
                                                        break
                                        if shared_bounds:
                                            best_match = b_data
                                            break
                                    if best_match:
                                        rate_before = best_match.get("selection_rate_favorable_outcomes")
                            except Exception:
                                pass

                        if rate_before is None:
                            rate_before = rate_after
                        
                        delta = round(rate_after - rate_before, 4)
                        
                        # Store both metrics inside the demographic group dictionary
                        group_data["selection_rate_before"] = round(rate_before, 4)
                        group_data["delta_selection_rate"] = delta

                        # Track the largest negative drop in this transformation
                        if delta < max_rate_drop:
                            max_rate_drop = delta
                    row_count_after = len(df_to_analyze)
                    
                    metadata_record = {
                        "script_name": script_name,
                        "transformation_name": transformation_name or func.__name__,
                        "timestamp": datetime.datetime.now().isoformat(),
                        "privileged_group": privileged_group,
                        "highest_selection_rate": highest_rate if privileged_group is not None else None,
                        "row_count_before": row_count_before,
                        "row_count_after": row_count_after,
                        "max_rate_drop": round(max_rate_drop, 4),
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
        transform_name = record.get("transformation_name", "")
        print(f"Generated Provenance Metadata for: {transform_name}", flush=True)

    def export_to_json(self, filepath=None):
        """
        Exports the tracked metadata records to a JSON file.
        Defaults to exporting to backend/storage/provenance_metadata.json
        """
        if filepath is None:
            backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
            filepath = os.path.join(backend_dir, "storage", "provenance_metadata.json")

        directory = os.path.dirname(filepath)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
            
        with open(filepath, 'w', encoding='utf-8') as f:
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
