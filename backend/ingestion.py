import os
import io
import re
import pandas as pd
from pypdf import PdfReader
from sqlalchemy.orm import Session
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.vectorstores.faiss import DistanceStrategy
from langchain_community.embeddings import HuggingFaceEmbeddings
from database import Candidate, engine
from config import EMBEDDING_MODEL, FAISS_PATH, get_logger

logger = get_logger("ingestion")

# Preload embedding model on CPU
embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL, model_kwargs={"device": "cpu"})

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    pdf_file = io.BytesIO(pdf_bytes)
    reader = PdfReader(pdf_file)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text

def parse_candidate_info(text: str):
    """Simple regex to extract email and name from resume text."""
    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
    email = email_match.group(0) if email_match else None
    
    # Heuristic for name: first non-empty line (clean it up slightly)
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    name = lines[0] if lines else "Unknown"
    if email and name == email:
        name = "Unknown"
        
    return name[:100], email

def ingest_pdf_resume(db: Session, filename: str, content: bytes) -> str:
    """Ingests a single PDF resume, saves it to SQLite, and updates FAISS."""
    text = extract_text_from_pdf(content)
    if not text.strip():
        raise ValueError("PDF content is empty or unparseable")
        
    name, email = parse_candidate_info(text)
    # Generate unique ID based on file name or email
    candidate_id = re.sub(r'[^a-zA-Z0-9]', '_', filename.split('.')[0])
    
    # Save to database
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        candidate = Candidate(id=candidate_id)
    candidate.name = name
    candidate.email = email
    candidate.resume_text = text
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    
    # Chunk and index in FAISS
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1024, chunk_overlap=500)
    chunks = text_splitter.split_text(text)
    
    # Add metadata to chunks
    metadatas = [{"ID": candidate_id} for _ in chunks]
    
    # Check if FAISS exists, else create new
    if os.path.exists(FAISS_PATH) and os.path.exists(os.path.join(FAISS_PATH, "index.faiss")):
        vectordb = FAISS.load_local(FAISS_PATH, embeddings, distance_strategy=DistanceStrategy.COSINE, allow_dangerous_deserialization=True)
        vectordb.add_texts(chunks, metadatas=metadatas)
    else:
        vectordb = FAISS.from_texts(chunks, embeddings, metadatas=metadatas, distance_strategy=DistanceStrategy.COSINE)
    
    vectordb.save_local(FAISS_PATH)
    return candidate_id

def ingest_csv_resumes(db: Session, csv_file_bytes: bytes):
    """Ingests multiple resumes from a CSV containing columns 'ID' and 'Resume'."""
    df = pd.read_csv(io.BytesIO(csv_file_bytes))
    if "Resume" not in df.columns or "ID" not in df.columns:
        raise ValueError("CSV must contain 'Resume' and 'ID' columns")
        
    # Write to SQLite
    for _, row in df.iterrows():
        cid = str(row["ID"])
        resume_text = str(row["Resume"])
        name, email = parse_candidate_info(resume_text)
        
        candidate = db.query(Candidate).filter(Candidate.id == cid).first()
        if not candidate:
            candidate = Candidate(id=cid)
        candidate.name = name
        candidate.email = email
        candidate.resume_text = resume_text
        db.add(candidate)
    db.commit()
    
    # Chunk and build/update vector store
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1024, chunk_overlap=500)
    all_chunks = []
    all_metadatas = []
    
    for _, row in df.iterrows():
        cid = str(row["ID"])
        chunks = text_splitter.split_text(str(row["Resume"]))
        all_chunks.extend(chunks)
        all_metadatas.extend([{"ID": cid} for _ in chunks])
        
    vectordb = FAISS.from_texts(all_chunks, embeddings, metadatas=all_metadatas, distance_strategy=DistanceStrategy.COSINE)
    vectordb.save_local(FAISS_PATH)
    return len(df)
