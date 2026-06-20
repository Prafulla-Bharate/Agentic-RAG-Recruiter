import os
import json
from typing import List, Optional
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

import database
from database import Candidate, get_db, init_db
import ingestion
import agents
import seed
from config import get_logger
from schemas import ScreenRequest, ChatMessage, ChatRequest

logger = get_logger("main")

# Initialize Database and Seed data on Startup
init_db()
try:
    seed.seed_database()
except Exception as e:
    logger.error(f"Failed seeding database on startup: {e}", exc_info=True)

app = FastAPI(title="Resume Screening Agentic API")

# Configure CORS for local development (React Vite usually runs on 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Resume Screening Agentic API is running"}

@app.post("/api/upload")
def upload_resumes(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    filename = file.filename
    try:
        content = file.file.read()
        if filename.endswith(".csv"):
            count = ingestion.ingest_csv_resumes(db, content)
            return {"message": f"Successfully ingested {count} resumes from CSV"}
        elif filename.endswith(".pdf"):
            candidate_id = ingestion.ingest_pdf_resume(db, filename, content)
            return {"message": f"Successfully ingested PDF resume. Assigned ID: {candidate_id}"}
        else:
            raise HTTPException(status_code=400, detail="Only CSV or PDF files are supported.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/screen")
def screen_resumes(
    req: ScreenRequest,
    db: Session = Depends(get_db)
):
    try:
        system = agents.MultiAgentScreeningSystem()
        results = system.run_screening_workflow(db, req.job_description, limit=req.limit)
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/candidates")
def get_candidates(db: Session = Depends(get_db)):
    try:
        candidates = db.query(Candidate).order_by(Candidate.score.desc()).all()
        result = []
        for c in candidates:
            # Try to reconstruct detail dictionary if stored, or basic schema
            details = {}
            if c.skills:
                details["skills_feedback"] = c.skills
            
            result.append({
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "score": c.score,
                "summary": c.summary,
                "details": details,
                "resume": c.resume_text
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
def chat_candidates(
    req: ChatRequest,
    db: Session = Depends(get_db)
):
    # Get candidate context from database
    candidates = []
    if req.candidate_ids:
        query = db.query(Candidate).filter(Candidate.id.in_(req.candidate_ids))
    else:
        # Default to top 5 candidates as context
        query = db.query(Candidate).order_by(Candidate.score.desc()).limit(5)
        
    for c in query.all():
        candidates.append({
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "score": c.score,
            "summary": c.summary,
            "details": {"skills_feedback": c.skills},
            "resume": c.resume_text
        })
        
    system = agents.MultiAgentScreeningSystem()
    history_dicts = [{"role": m.role, "content": m.content} for m in req.chat_history]
    
    def event_generator():
        try:
            for text_chunk in system.chat_about_candidates(req.query, candidates, history_dicts):
                yield text_chunk
        except Exception as e:
            yield f"\n[Error generating response: {str(e)}]"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
