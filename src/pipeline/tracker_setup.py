from src.utils.provenance import ProvenanceMetadataTracker

tracker = ProvenanceMetadataTracker(
    protected_attributes=[ 
        {'name': 'age', 'type': 'continuous'}, 
        {'name': 'race', 'type': 'categorical'}, 
        {'name': 'sex', 'type': 'categorical'}
    ],
    target_variable={'name': 'income', 'positive': 'TRUE', 'negative': 'FALSE'}
)
