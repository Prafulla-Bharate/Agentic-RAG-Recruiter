import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    print("Starting FastAPI Integration Verification...")
    
    # 1. Healthcheck
    try:
        res = requests.get(f"{BASE_URL}/")
        print(f"Healthcheck: Status {res.status_code}, Response: {res.json()}")
    except Exception as e:
        print(f"Failed to connect to FastAPI: {e}")
        print("Make sure to run Uvicorn before running tests!")
        return

    # 2. Get Candidates (Verify seeding worked)
    res = requests.get(f"{BASE_URL}/api/candidates")
    print(f"Get Candidates: Status {res.status_code}")
    candidates = res.json()
    print(f"Found {len(candidates)} candidates in SQLite database.")
    
    if len(candidates) > 0:
        print(f"Sample Candidate ID: {candidates[0]['id']}, Name: {candidates[0]['name']}")
    else:
        print("Warning: Database is empty!")
        
    print("API Integration test check completed successfully!")

if __name__ == "__main__":
    test_api()
