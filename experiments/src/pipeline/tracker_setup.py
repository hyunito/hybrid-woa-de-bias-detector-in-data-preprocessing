
import os
import sys
import atexit

_current_dir = os.path.dirname(os.path.abspath(__file__))
_utils_dir = os.path.join(_current_dir, "utils")
if _utils_dir not in sys.path:
    sys.path.insert(0, _utils_dir)

from utils.provenance import ProvenanceMetadataTracker


tracker = ProvenanceMetadataTracker(
    protected_attributes=[
        {'name': 'age', 'type': 'continuous'}, 
        {'name': 'race', 'type': 'categorical'}, 
        {'name': 'sex', 'type': 'categorical'}],
    target_variable={'name': 'income', 'positive': '>50K', 'negative': '<=50K'}
)

def _auto_export_on_exit():
    if hasattr(tracker, 'metadata_records') and tracker.metadata_records:
        # Determine root directory for provenance_metadata.json
        root_dir = os.path.abspath(os.path.join(_current_dir, "..", ".."))
        json_path = os.path.join(root_dir, "provenance_metadata.json")
        try:
            tracker.export_to_database()
        except Exception as e:
            print(f"[Tracker] Notice: Could not export to DB ({e}), falling back to JSON.")
        try:
            tracker.export_to_json(json_path)
            print(f"[Tracker] Auto-exported {len(tracker.metadata_records)} provenance records to {json_path}")
        except Exception as e:
            print(f"[Tracker] Error exporting to JSON: {e}")

atexit.register(_auto_export_on_exit)

tracker = ProvenanceMetadataTracker(
    protected_attributes=[ 
        {'name': 'age', 'type': 'continuous'}, 
        {'name': 'race', 'type': 'categorical'}, 
        {'name': 'sex', 'type': 'categorical'}
    ],
    target_variable={'name': 'income', 'positive': 'TRUE', 'negative': 'FALSE'}
)