import os
from typing import List, Optional
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from config import PIPELINE_DIR, CHUNK_SIZE, SESSION_REGISTRY

router = APIRouter(prefix="/api", tags=["Dashboard"])

@router.post("/dataset/scan")
async def scan_dataset(file: UploadFile = File(...), session_id: Optional[str] = Form(None)):
    """
    Streams uploaded CSV directly to disk in backend/dataset/ in 1 MB chunks to avoid RAM spikes.
    Then scans the first 1,000 rows from disk for column types and binary targets.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")
    
    file_path = os.path.join(PIPELINE_DIR, file.filename)
    try:
        with open(file_path, "wb") as f_out:
            while chunk := await file.read(CHUNK_SIZE):
                f_out.write(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stream dataset to disk: {str(e)}")

    # Register to session for safe cleanup on exit
    if session_id:
        if session_id not in SESSION_REGISTRY:
            SESSION_REGISTRY[session_id] = {"datasets": set(), "scripts": set()}
        SESSION_REGISTRY[session_id]["datasets"].add(file_path)

    try:
        df = pd.read_csv(file_path, nrows=1000)
        columns_info = []
        binary_targets = []
        
        for col in df.columns:
            series = df[col].dropna()
            unique_vals = series.unique()
            n_unique = len(unique_vals)
            is_numeric = pd.api.types.is_numeric_dtype(df[col])
            
            is_binary = False
            unique_str_vals = [str(v) for v in unique_vals]
            if n_unique == 2:
                is_binary = True
                binary_targets.append({
                    "column": col,
                    "values": unique_str_vals
                })
            
            col_type = "Continuous" if (is_numeric and n_unique > 10) else "Categorical"
            
            columns_info.append({
                "id": str(col),
                "name": str(col),
                "type": col_type,
                "is_binary": is_binary
            })
            
        return {
            "status": "success",
            "filename": file.filename,
            "saved_path": file_path,
            "total_columns": len(columns_info),
            "columns": columns_info,
            "binary_targets": binary_targets
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading dataset: {str(e)}")

@router.post("/pipeline/upload-scripts")
async def upload_pipeline_scripts(
    files: List[UploadFile] = File(...),
    session_id: Optional[str] = Form(None)
):
    """
    Streams uploaded Python preprocessing scripts directly to backend/pipeline/ in 1 MB chunks.
    Preserves existing files and scripts in the folder.
    """
    uploaded = []
    
    if session_id and session_id not in SESSION_REGISTRY:
        SESSION_REGISTRY[session_id] = {"datasets": set(), "scripts": set()}

    for file in files:
        if not file.filename.endswith(".py"):
            continue
        dest_path = os.path.join(PIPELINE_DIR, file.filename)
        try:
            with open(dest_path, "wb") as f_out:
                while chunk := await file.read(CHUNK_SIZE):
                    f_out.write(chunk)
            uploaded.append(file.filename)
            if session_id:
                SESSION_REGISTRY[session_id]["scripts"].add(dest_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save script {file.filename}: {str(e)}")

    return {
        "status": "success",
        "uploaded_count": len(uploaded),
        "uploaded_scripts": uploaded
    }
