import os
import logging
from dotenv import load_dotenv

# Load environmental configs
load_dotenv()

# App paths relative to root or backend folders
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BACKEND_DIR)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(BACKEND_DIR, 'resumes.db')}")
DATA_PATH = os.getenv("DATA_PATH", os.path.join(ROOT_DIR, "data", "pdf-resumes.csv"))
FAISS_PATH = os.getenv("FAISS_PATH", os.path.join(ROOT_DIR, "vectorstore-pdf"))
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

# Setup logging system
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)

def get_logger(name: str):
    return logging.getLogger(name)
