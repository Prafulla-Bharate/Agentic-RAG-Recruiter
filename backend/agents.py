import os
import json
import re
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from sqlalchemy.orm import Session
from langchain_community.vectorstores import FAISS
from langchain_community.vectorstores.faiss import DistanceStrategy
from langchain_community.embeddings import HuggingFaceEmbeddings
from database import Candidate, get_db
from config import EMBEDDING_MODEL, FAISS_PATH, get_logger

logger = get_logger("agents")

class MultiAgentScreeningSystem:
    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        resolved_api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not resolved_api_key:
            raise ValueError("Google GenAI API Key is not set in environment or parameter")
            
        genai.configure(api_key=resolved_api_key)
        
        target_model = model_name or os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        self.embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL, model_kwargs={"device": "cpu"})
        self.model_name = self._resolve_model_name(target_model)
        
    def _resolve_model_name(self, requested_model: str) -> str:
        """Dynamically verifies if the requested model exists.
        If not, falls back to the first available model that supports generation.
        """
        try:
            available_models = list(genai.list_models())
            available_names = [m.name for m in available_models]
            req_name = requested_model if requested_model.startswith("models/") else f"models/{requested_model}"
            
            if req_name in available_names:
                return requested_model
                
            logger.warning(f"Requested model '{requested_model}' not found in available models. Resolving fallback...")
            
            # Find models supporting generateContent
            generation_models = []
            for m in available_models:
                if hasattr(m, "supported_generation_methods") and "generateContent" in m.supported_generation_methods:
                    generation_models.append(m.name)
            
            if not generation_models:
                return requested_model
                
            # Look for a 'flash' model first
            flash_models = [name for name in generation_models if "flash" in name.lower()]
            if flash_models:
                fallback = flash_models[0].replace("models/", "")
                logger.warning(f"Falling back to available flash model: '{fallback}'")
                return fallback
                
            # Look for a 'pro' model next
            pro_models = [name for name in generation_models if "pro" in name.lower()]
            if pro_models:
                fallback = pro_models[0].replace("models/", "")
                logger.warning(f"Falling back to available pro model: '{fallback}'")
                return fallback
                
            # Otherwise return the first available generation model
            fallback = generation_models[0].replace("models/", "")
            logger.warning(f"Falling back to first available generation model: '{fallback}'")
            return fallback
            
        except Exception as e:
            logger.error(f"Error resolving model name from API: {e}")
            return requested_model
        
    def _call_gemini_json(self, system_instruction: str, prompt: str, temperature: float = 0.1) -> Dict[str, Any]:
        """Calls Gemini forcing a JSON response format."""
        try:
            model = genai.GenerativeModel(
                model_name=self.model_name,
                system_instruction=system_instruction
            )
            response = model.generate_content(
                prompt,
                generation_config={
                    "temperature": temperature,
                    "response_mime_type": "application/json"
                }
            )
            return json.loads(response.text)
        except Exception as e:
            # Fallback regex search if JSON parsing fails
            try:
                # Try generating content without system instruction if model complains
                model = genai.GenerativeModel(model_name=self.model_name)
                response = model.generate_content(
                    f"{system_instruction}\n\nUser request: {prompt}",
                    generation_config={"temperature": temperature, "response_mime_type": "application/json"}
                )
                return json.loads(response.text)
            except Exception as e_inner:
                print(f"Error calling Gemini JSON: {e_inner}")
                # return a basic template
                return {}

    def extract_jd_criteria(self, job_description: str) -> Dict[str, Any]:
        """Agent 1: Extracts key qualifications, experience, and skills from a Job Description."""
        system_instruction = (
            "You are an expert technical recruiter. Analyze the job description and extract candidate selection criteria. "
            "Respond ONLY with a JSON object following this schema:\n"
            "{\n"
            "  \"job_title\": \"string\",\n"
            "  \"required_skills\": [\"skill1\", \"skill2\"],\n"
            "  \"preferred_skills\": [\"skill1\", \"skill2\"],\n"
            "  \"min_years_experience\": integer_or_float,\n"
            "  \"min_education_level\": \"string (e.g., Bachelor, Master, PhD)\",\n"
            "  \"summary_requirements\": \"brief summary of responsibilities\"\n"
            "}"
        )
        prompt = f"Extract structured criteria from this Job Description:\n\n{job_description}"
        return self._call_gemini_json(system_instruction, prompt)

    def grade_resume(self, resume_text: str, criteria: Dict[str, Any]) -> Dict[str, Any]:
        """Agent 2: Grades a single candidate's resume against extracted job criteria."""
        system_instruction = (
            "You are an AI resume grader. Evaluate the candidate's resume against the target job criteria. "
            "For skills match, experience match, and education match, assign a score from 0 to 100. "
            "Calculate an overall match score from 0 to 100. Be honest and strict. "
            "Respond ONLY with a JSON object following this schema:\n"
            "{\n"
            "  \"skills_score\": integer,\n"
            "  \"experience_score\": integer,\n"
            "  \"education_score\": integer,\n"
            "  \"overall_score\": integer,\n"
            "  \"skills_feedback\": \"what skills they have and what they lack\",\n"
            "  \"experience_feedback\": \"summary of relevant work history\",\n"
            "  \"education_feedback\": \"summary of degrees and certifications\",\n"
            "  \"strengths\": [\"strength1\", \"strength2\"],\n"
            "  \"weaknesses\": [\"weakness1\", \"weakness2\"]\n"
            "}"
        )
        prompt = (
            f"Resume Text:\n{resume_text}\n\n"
            f"Job Criteria:\n{json.dumps(criteria, indent=2)}"
        )
        return self._call_gemini_json(system_instruction, prompt)

    def run_screening_workflow(self, db: Session, job_description: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Coordinates the Agentic Screening workflow:
        1. Extract JD Criteria (JD Extractor Agent)
        2. Perform Semantic Search on FAISS to fetch candidates
        3. Grade candidates (Grader Agent)
        4. Save grades to SQLite database
        5. Return sorted results
        """
        # Step 1: Extract criteria
        criteria = self.extract_jd_criteria(job_description)
        logger.info(f"Extracted Criteria: {criteria}")
        
        # Step 2: Retrieve candidates using RAG
        # We perform vector search to retrieve relevant candidates. We search for top candidates
        candidate_ids = []
        if os.path.exists(FAISS_PATH) and os.path.exists(os.path.join(FAISS_PATH, "index.faiss")):
            vectordb = FAISS.load_local(FAISS_PATH, self.embeddings, distance_strategy=DistanceStrategy.COSINE, allow_dangerous_deserialization=True)
            # Retrieve up to 20 chunks to narrow down the candidate list
            search_results = vectordb.similarity_search_with_score(job_description, k=15)
            # Gather unique candidate IDs, retaining order of similarity
            seen = set()
            for doc, score in search_results:
                cid = str(doc.metadata.get("ID"))
                if cid not in seen:
                    seen.add(cid)
                    candidate_ids.append(cid)
        
        # If vectorstore is empty or no candidates found, fallback to database records
        if not candidate_ids:
            candidates_all = db.query(Candidate).limit(10).all()
            candidate_ids = [c.id for c in candidates_all]
            
        logger.info(f"Candidates to grade: {candidate_ids[:limit]}")
        
        results = []
        for cid in candidate_ids[:limit]:
            candidate = db.query(Candidate).filter(Candidate.id == cid).first()
            if not candidate:
                continue
            
            # Step 3: Grade candidate
            grade_result = self.grade_resume(candidate.resume_text, criteria)
            logger.info(f"Graded Candidate {cid}: Overall Score {grade_result.get('overall_score')}")
            
            # Step 4: Update SQLite Database
            overall_score = float(grade_result.get("overall_score", 0.0))
            candidate.score = overall_score
            
            # Save parsed metadata back to DB if available
            skills_feedback = grade_result.get("skills_feedback", "")
            candidate.skills = skills_feedback
            
            # Create a structured explanation string
            explanation = (
                f"### Strengths\n" + "\n".join([f"- {s}" for s in grade_result.get("strengths", [])]) + "\n\n"
                f"### Weaknesses\n" + "\n".join([f"- {w}" for w in grade_result.get("weaknesses", [])]) + "\n\n"
                f"### Experience Feedback\n{grade_result.get('experience_feedback', '')}\n\n"
                f"### Education Feedback\n{grade_result.get('education_feedback', '')}"
            )
            candidate.summary = explanation
            db.add(candidate)
            
            # Append score details to returned list
            results.append({
                "id": cid,
                "name": candidate.name,
                "email": candidate.email,
                "score": overall_score,
                "details": grade_result,
                "summary": explanation,
                "resume": candidate.resume_text
            })
            
        db.commit()
        
        # Sort candidates by overall score descending
        results = sorted(results, key=lambda x: x["score"], reverse=True)
        return results

    def chat_about_candidates(self, query: str, context_candidates: List[Dict[str, Any]], chat_history: List[Dict[str, str]]):
        """Conversational Agent interface to answer recruiters questions about candidates."""
        # Format candidate profiles as reference context
        context_str = ""
        for idx, c in enumerate(context_candidates):
            context_str += (
                f"Candidate {idx+1}: ID={c.get('id')}, Name={c.get('name')}, Email={c.get('email')}, Match Score={c.get('score')}%\n"
                f"Evaluation details: {json.dumps(c.get('details'), indent=1)}\n"
                f"Resume Snippet:\n{c.get('resume')[:1200]}\n"
                f"--------------------------------------------------\n"
            )
            
        system_instruction = (
            "You are an elite AI Recruiter Coordinator. Provide actionable, concise answers to the recruiter's questions "
            "based on the candidate evaluation reports and resumes provided in the context. "
            "Highlight strengths/weaknesses and comparative details between candidates. Be professional and objective."
        )
        
        # Prepare content list
        contents = []
        for msg in chat_history:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({"role": role, "parts": [msg["content"]]})
            
        # Append context + query
        user_prompt = f"Candidate Context:\n{context_str}\n\nUser Question:\n{query}"
        contents.append({"role": "user", "parts": [user_prompt]})
        
        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_instruction
        )
        
        # Stream response
        response = model.generate_content(contents, stream=True)
        for chunk in response:
            if chunk.text:
                yield chunk.text
