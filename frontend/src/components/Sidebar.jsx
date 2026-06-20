import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Settings, 
  UploadCloud, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  User 
} from 'lucide-react';
import { api } from '../services/api';

export default function Sidebar({
  candidates,
  allCandidates = [],
  selectedCandidate,
  setSelectedCandidate,
  refreshCandidates,
  setAppError,
  hasScreened = false
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset page when query, candidates, or screen state changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, hasScreened, candidates]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus({ type: 'info', message: "Ingesting candidate data..." });
    setAppError(null);

    try {
      const data = await api.uploadResume(file);
      setUploadStatus({ type: 'success', message: data.message });
      refreshCandidates();
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.message || "Ingestion failed" });
    } finally {
      setUploading(false);
    }
  };

  // Determine source pool
  const sourceCandidates = hasScreened ? candidates : allCandidates;

  // Filter candidates based on query & screening state
  const filteredCandidates = sourceCandidates.filter(c => {
    if (!searchQuery.trim()) {
      return hasScreened; // Only show on empty query if we actually screened candidates
    }
    const query = searchQuery.toLowerCase();
    const idStr = String(c.id || "");
    const resumeText = c.resume || c.resume_text || "";
    return (
      (c.name && c.name.toLowerCase().includes(query)) ||
      (idStr.toLowerCase().includes(query)) ||
      (resumeText.toLowerCase().includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query))
    );
  });

  // Sort candidates by score descending if screened
  const sortedCandidates = hasScreened
    ? [...filteredCandidates].sort((a, b) => b.score - a.score)
    : filteredCandidates;

  // Screened candidates are already limited by the backend configuration count
  const displayCandidates = sortedCandidates;

  // Pagination details
  const totalPages = Math.ceil(displayCandidates.length / itemsPerPage);
  const paginatedCandidates = displayCandidates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Header title resolver
  const getHeaderTitle = () => {
    if (hasScreened) {
      return `Screened Matches (${displayCandidates.length})`;
    } else {
      return searchQuery.trim() ? `Search Results (${displayCandidates.length})` : "Candidate Pool";
    }
  };

  return (
    <aside className="glass-card" style={{ width: '300px', borderRight: '1px solid var(--border-glass)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', borderRadius: '0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Sparkles color="var(--color-primary)" size={28} />
        <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '700', letterSpacing: '-0.025em' }}>Agentic Screening</h2>
      </div>

      {/* FILE UPLOAD */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Ingestion Engine</span>
        <label className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', borderStyle: 'dashed', cursor: 'pointer', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
          <UploadCloud size={32} color={uploading ? 'var(--color-primary)' : 'var(--text-secondary)'} className={uploading ? "animate-pulse-slow" : ""} />
          <span style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--text-secondary)' }}>Upload CSV or Resumes PDFs</span>
          <input type="file" onChange={handleFileUpload} accept=".csv,.pdf" style={{ display: 'none' }} />
        </label>

        {uploadStatus && (
          <div style={{ display: 'flex', gap: '8px', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', background: uploadStatus.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: uploadStatus.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)', border: '1px solid rgba(255,255,255,0.02)' }}>
            {uploadStatus.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{uploadStatus.message}</span>
          </div>
        )}
      </div>

      {/* INDEXED POOL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '200px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
            {getHeaderTitle()}
          </span>
          <RefreshCw size={14} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={refreshCandidates} />
        </div>

        <input 
          type="text" 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          placeholder="🔍 Search name, ID, skills..." 
          className="glass-input" 
          style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.8rem', padding: '8px 12px' }}
        />

        {/* SCROLLABLE LIST CONTAINER */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
          {paginatedCandidates.map((c) => (
            <div 
              key={c.id} 
              onClick={() => setSelectedCandidate(c)}
              className="glass-card" 
              style={{ 
                padding: '12px', 
                cursor: 'pointer', 
                borderLeft: selectedCandidate?.id === c.id ? '4px solid var(--color-primary)' : '1px solid var(--border-glass)',
                background: selectedCandidate?.id === c.id ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-glass)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{c.name || "Unknown"}</span>
                <span 
                  style={{ 
                    fontSize: '0.75rem', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    fontWeight: '700',
                    background: c.score >= 80 ? 'rgba(16, 185, 129, 0.15)' : c.score >= 50 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)',
                    color: c.score >= 80 ? 'var(--color-success)' : c.score >= 50 ? 'var(--color-warning)' : 'var(--text-secondary)'
                  }}
                >
                  {c.score && c.score > 0 ? `${c.score}%` : 'N/A'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={12} /> ID: {c.id}
              </div>
            </div>
          ))}
          {displayCandidates.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '30px 10px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              {!hasScreened && !searchQuery.trim() ? (
                <>
                  <User size={20} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                  <span>Search for candidates or run screening to view matches.</span>
                </>
              ) : searchQuery.trim() ? (
                <span>No matching candidates found.</span>
              ) : (
                <span>No screened candidates available.</span>
              )}
            </div>
          )}
        </div>

        {/* PAGINATION PANEL FOOTER */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
              disabled={currentPage === 1}
              className="glass-btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.72rem', borderRadius: '6px', cursor: 'pointer' }}
            >
              Prev
            </button>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
              disabled={currentPage === totalPages}
              className="glass-btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.72rem', borderRadius: '6px', cursor: 'pointer' }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
