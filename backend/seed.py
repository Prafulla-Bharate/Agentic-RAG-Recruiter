import os
import pandas as pd
from sqlalchemy.orm import Session
from database import SessionLocal, Candidate, init_db
from ingestion import parse_candidate_info, embeddings
from langchain_community.vectorstores import FAISS
from langchain_community.vectorstores.faiss import DistanceStrategy
from langchain.text_splitter import RecursiveCharacterTextSplitter
from config import DATA_PATH, FAISS_PATH, get_logger

logger = get_logger("seed")

def seed_database():
    init_db()
    db = SessionLocal()
    try:
        # Check if database already has candidates
        count = db.query(Candidate).count()
        if count > 0:
            logger.info(f"Database already seeded with {count} candidates.")
            return

        data_path = DATA_PATH
        if not os.path.exists(data_path):
            # Fallback path if run from root or different subfolder
            alt_path = "../data/pdf-resumes.csv"
            if os.path.exists(alt_path):
                data_path = alt_path
            else:
                logger.error(f"Candidate resumes CSV not found at {data_path}")
                return
        
        df = pd.read_csv(data_path)
        if "Resume" not in df.columns or "ID" not in df.columns:
            logger.warning("CSV does not contain 'Resume' and 'ID' columns. Skipping seed.")
            return
            
        logger.info(f"Loading {len(df)} resumes into SQLite...")
        for _, row in df.iterrows():
            cid = str(row["ID"])
            resume_text = str(row["Resume"])
            name, email = parse_candidate_info(resume_text)
            
            # Insert candidate
            candidate = Candidate(
                id=cid,
                name=name,
                email=email,
                resume_text=resume_text,
                score=0.0,
                summary=None
            )
            db.add(candidate)
        db.commit()
        logger.info("Successfully loaded resumes into SQLite.")

        # Check if FAISS index exists
        if not (os.path.exists(FAISS_PATH) and os.path.exists(os.path.join(FAISS_PATH, "index.faiss"))):
            logger.info("FAISS index not found. Building FAISS index (this may take a minute)...")
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1024, chunk_overlap=500)
            all_chunks = []
            all_metadatas = []
            
            for _, row in df.iterrows():
                cid = str(row["ID"])
                chunks = text_splitter.split_text(str(row["Resume"]))
                all_chunks.extend(chunks)
                all_metadatas.extend([{"ID": cid} for _ in chunks])
                
            vectordb = FAISS.from_texts(
                all_chunks, 
                embeddings, 
                metadatas=all_metadatas, 
                distance_strategy=DistanceStrategy.COSINE
            )
            vectordb.save_local(FAISS_PATH)
            logger.info("Successfully built and saved FAISS index.")
        else:
            logger.info("FAISS index already exists.")

    except Exception as e:
        logger.error(f"Error seeding database: {e}", exc_info=True)
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
