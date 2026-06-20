from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ScreenRequest(BaseModel):
    job_description: str
    limit: Optional[int] = 5

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    chat_history: List[ChatMessage]
    candidate_ids: Optional[List[str]] = []

class CandidateResponse(BaseModel):
    id: str
    name: Optional[str]
    email: Optional[str]
    score: float
    summary: Optional[str]
    details: Dict[str, Any]
    resume: str
