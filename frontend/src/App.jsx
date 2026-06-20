import React, { useState, useEffect } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Workspace from './components/Workspace';
import ChatWorkspace from './components/ChatWorkspace';
import { api } from './services/api';

export default function App() {
  // App State Data
  const [jobDescription, setJobDescription] = useState("");
  const [candidates, setCandidates] = useState([]); // Screened matches
  const [allCandidates, setAllCandidates] = useState([]); // Entire pool from database
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [hasScreened, setHasScreened] = useState(false);
  
  // Interface Feedback States
  const [isScreening, setIsScreening] = useState(false);
  const [appError, setAppError] = useState(null);
  
  // Chat Logs
  const [chatHistory, setChatHistory] = useState([
    { role: 'model', content: "Hello! I am your AI Recruiter. Paste your target Job Description and run the screening workflow, and I'll help you analyze the results." }
  ]);
  const [isChatting, setIsChatting] = useState(false);

  // Load all candidates from the database on startup
  useEffect(() => {
    const loadCandidates = async () => {
      try {
        const data = await api.fetchCandidates();
        setAllCandidates(data);
      } catch (err) {
        setAppError("Failed to fetch initial candidates: " + err.message);
      }
    };
    loadCandidates();
  }, []);

  const handleScreening = async (limit = 5) => {
    if (!jobDescription.trim()) {
      setAppError("Please paste a target Job Description to screen candidates against.");
      return;
    }

    setIsScreening(true);
    setAppError(null);
    setHasScreened(false);
    try {
      const data = await api.screenResumes(jobDescription, limit); // Pass dynamic shortlist count limit
      if (data.status === "success") {
        setCandidates(data.results);
        setHasScreened(true);
        if (data.results.length > 0) {
          setSelectedCandidate(data.results[0]);
          setChatHistory(prev => [
            ...prev,
            { role: 'user', content: `Screen candidates based on JD: ${jobDescription.substring(0, 100)}...` },
            { role: 'model', content: `I have screened the candidates! The top match is **${data.results[0].name}** with a scorecard score of **${data.results[0].score}%**. Ask me details or comparative queries.` }
          ]);
        } else {
          setCandidates([]);
          setSelectedCandidate(null);
        }
      }
    } catch (err) {
      setAppError(err.message || "Screening process failed.");
    } finally {
      setIsScreening(false);
    }
  };

  const handleUploadSuccess = async () => {
    setCandidates([]);
    setSelectedCandidate(null);
    setHasScreened(false);
    try {
      const data = await api.fetchCandidates();
      setAllCandidates(data);
    } catch (err) {
      setAppError("Failed to refresh candidate database.");
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
      
      {/* 1. LEFT CONTROL SIDEBAR */}
      <Sidebar
        candidates={candidates}
        allCandidates={allCandidates}
        selectedCandidate={selectedCandidate}
        setSelectedCandidate={setSelectedCandidate}
        refreshCandidates={handleUploadSuccess}
        setAppError={setAppError}
        hasScreened={hasScreened}
      />

      {/* 2. CENTER WORKSPACE CONTENT */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', boxSizing: 'border-box', overflowY: 'auto' }}>
        
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.03em', margin: '0 0 4px 0' }}>Resume Screener Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Multi-agent automated ranking using structured AI reflection loops.</p>
          </div>
        </header>

        {appError && (
          <div style={{ display: 'flex', gap: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '14px', borderRadius: '8px', color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '20px' }}>
            <AlertCircle size={18} />
            <span>{appError}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', flex: 1, minHeight: 0 }}>
          
          <Workspace
            jobDescription={jobDescription}
            setJobDescription={setJobDescription}
            isScreening={isScreening}
            handleScreening={handleScreening}
            selectedCandidate={selectedCandidate}
          />

          {/* 3. RIGHT RECRUITER AI CHAT WORKSPACE */}
          <ChatWorkspace
            candidates={candidates}
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            isChatting={isChatting}
            setIsChatting={setIsChatting}
            setAppError={setAppError}
          />

        </div>
      </main>

    </div>
  );
}
