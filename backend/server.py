from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import uuid
from typing import List, Optional
from pydantic import BaseModel
import os
import sys
import pandas as pd
import io
sys.path.append(os.path.join(os.path.dirname(__file__), "engine"))
from engine.audit import run_audit
from engine.feedback import generate_mitigation_report



app = FastAPI(title="PROBA", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {
        "status": "online",
        "message": "PROBA Backend is running and ready!"
    }

@app.post("/api/dataset/scan")
async def scan_dataset(file: UploadFile = File(...)):
    """
    Scans an uploaded CSV in-memory.
    Returns column names, suggested types (Continuous vs Categorical),
    and detects binary target candidates (columns with exactly 2 unique values).
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")
    
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents), nrows=100)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    columns = []
    binary_targets = []

    for idx, col_name in enumerate(df.columns, 1):
        clean_name = str(col_name).strip()
        series = df[col_name].dropna()
        
        unique_vals = [str(v) for v in series.unique()]
        
        is_numeric = pd.api.types.is_numeric_dtype(series)
        col_type = "Continuous" if (is_numeric and len(unique_vals) > 10) else "Categorical"
        
        is_binary = (len(unique_vals) == 2)
        
        columns.append({
            "id": str(idx),
            "name": clean_name,
            "type": col_type,
            "is_binary": is_binary,
            "unique_values": unique_vals,
            "sample_values": unique_vals[:5]
        })

        if is_binary:
            binary_targets.append({
                "column": clean_name,
                "values": unique_vals
            })

    return {
        "filename": file.filename,
        "total_columns": len(columns),
        "columns": columns,
        "binary_targets": binary_targets
    }

class AuditRequest(BaseModel):
    bias_threshold: Optional[float] = 0.2
    num_whales: Optional[int] = 3
    max_iter: Optional[int] = 5
    
@app.post("/api/audit/run")
def start_audit(request: AuditRequest):
    audit_id = str(uuid.uuid4())[:8]
    print(f"\n[API] Received audit request {audit_id} with threshold {request.bias_threshold}")
  
    ranked_biases = run_audit(threshold=request.bias_threshold)
 
    recommendations, script_rollups = generate_mitigation_report(ranked_biases)
   
    return {
        "audit_id": audit_id,
        "status": "completed",
        "threshold": request.bias_threshold,
        "total_ranked_findings": len(ranked_biases),
        "qualifying_recommendations": len(recommendations),
        "results": {
            "ranked_biases": ranked_biases,
            "recommendations": recommendations,
            "script_rollups": script_rollups
        }
    }


if __name__ == "__main__":
   
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
