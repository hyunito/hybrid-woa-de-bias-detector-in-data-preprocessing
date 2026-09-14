from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import uuid
from typing import List, Optional
from pydantic import BaseModel
import os
import sys
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


class AuditRequest(BaseModel):
    dataset_name: Optional[str] = "dataset/adult_income_100K.csv"
    demographic_attributes: Optional[List[str]] = ["age", "race", "sex"]
    target_column: Optional[str] = "income"
    bias_threshold: Optional[float] = 0.2
    num_whales: Optional[int] = 3
    max_iter: Optional[int] = 5
    
@app.post("/api/audit/run")
def start_audit(request: AuditRequest):
    audit_id = str(uuid.uuid4())[:8]
    print(f"\n[API] Received audit request {audit_id} with threshold {request.bias_threshold}")
  
    ranked_biases = run_audit()
 
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
