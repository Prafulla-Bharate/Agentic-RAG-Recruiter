import React from 'react';
import { 
  Briefcase, 
  Sparkles, 
  RefreshCw, 
  Mail, 
  Layers, 
  Info, 
  Database,
  Loader2,
  CheckCircle2,
  Circle
} from 'lucide-react';


function ScreeningStep({ stepNumber, title, description, activeStep }) {
  const isCompleted = activeStep > stepNumber;
  const isActive = activeStep === stepNumber;

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '12px', 
      padding: '12px 16px', 
      background: isActive ? 'rgba(99, 102, 241, 0.06)' : 'rgba(255, 255, 255, 0.01)', 
      border: isActive ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid var(--border-glass)', 
      borderRadius: '8px',
      opacity: isActive || isCompleted ? 1 : 0.4,
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px' }}>
        {isCompleted ? (
          <CheckCircle2 size={16} color="var(--color-success)" />
        ) : isActive ? (
          <Loader2 size={16} color="var(--color-primary)" className="animate-spin-slow" />
        ) : (
          <Circle size={16} color="var(--text-muted)" style={{ opacity: 0.5 }} />
        )}
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: '600', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{title}</h4>
        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{description}</p>
      </div>
      {isActive && (
        <span style={{ fontSize: '0.68rem', color: 'var(--color-primary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }} className="animate-pulse-slow">
          Running
        </span>
      )}
    </div>
  );
}

export default function Workspace({
  jobDescription,
  setJobDescription,
  isScreening,
  handleScreening,
  selectedCandidate
}) {
  const [activeScreeningStep, setActiveScreeningStep] = React.useState(1);
  const [shortlistLimit, setShortlistLimit] = React.useState(5);

  React.useEffect(() => {
    let interval;
    if (isScreening) {
      setActiveScreeningStep(1);
      interval = setInterval(() => {
        setActiveScreeningStep(prev => (prev < 4 ? prev + 1 : 4));
      }, 1500); // Progress every 1.5 seconds
    } else {
      setActiveScreeningStep(1);
    }
    return () => clearInterval(interval);
  }, [isScreening]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '4px' }}>
      
      {/* JOB DESCRIPTION CARD */}
      <section className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Briefcase size={18} color="var(--color-primary)" />
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600' }}>Active Job Description</h3>
        </div>
        <textarea 
          rows={5} 
          value={jobDescription} 
          onChange={(e) => setJobDescription(e.target.value)} 
          placeholder="Paste the Job Description (JD) here. The agentic screener will analyze requirements, retrieve matching resumes from the vector space, and evaluate candidates..."
          className="glass-input"
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Candidates to shortlist:</span>
            <input 
              type="number" 
              min="1" 
              max="50" 
              value={shortlistLimit} 
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Math.max(1, Math.min(50, Number(e.target.value)));
                setShortlistLimit(val);
              }} 
              onBlur={() => {
                if (shortlistLimit === '' || shortlistLimit < 1) {
                  setShortlistLimit(5);
                }
              }}
              className="glass-input" 
              style={{ width: '60px', padding: '6px 10px', fontSize: '0.8rem', textAlign: 'center' }}
              disabled={isScreening}
            />
          </div>
          <button 
            onClick={() => handleScreening(shortlistLimit || 5)} 
            disabled={isScreening}
            className="glass-btn"
          >
            {isScreening ? (
              <>
                <RefreshCw className="animate-spin-slow" size={16} />
                Screening Candidates...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Run Agentic Screener
              </>
            )}
          </button>
        </div>
      </section>

      {/* CANDIDATE EVALUATION WORKSPACE */}
      {isScreening ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', flex: 1, minHeight: '400px' }} className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Loader2 className="animate-spin-slow" size={40} color="var(--color-primary)" />
          </div>
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: '600' }}>Agentic Screening In Progress</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', textAlign: 'center', maxWidth: '340px', margin: '0 0 28px 0', lineHeight: '1.4' }}>
            Our multi-agent system is running semantic retrieval and grading loops.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '380px' }}>
            <ScreeningStep stepNumber={1} title="Requirement Extractor Agent" description="Analyzing JD & extracting criteria" activeStep={activeScreeningStep} />
            <ScreeningStep stepNumber={2} title="RAG Semantic Retriever" description="Fetching candidates from FAISS index" activeStep={activeScreeningStep} />
            <ScreeningStep stepNumber={3} title="Resume Grader Agent" description="Evaluating candidate matches and scoring" activeStep={activeScreeningStep} />
            <ScreeningStep stepNumber={4} title="Database Sync Engine" description="Saving scorecard reports to SQLite" activeStep={activeScreeningStep} />
          </div>
        </div>
      ) : selectedCandidate ? (
        <section className="glass-card" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Header metadata */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: '700' }}>{selectedCandidate.name || "Unknown"}</h3>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={14} /> {selectedCandidate.email || "No Email Found"}</span>
                <span>ID: {selectedCandidate.id}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: selectedCandidate.score >= 80 ? 'var(--color-success)' : selectedCandidate.score >= 50 ? 'var(--color-warning)' : 'var(--text-secondary)', lineHeight: '1.1' }}>
                {selectedCandidate.score && selectedCandidate.score > 0 ? `${selectedCandidate.score}%` : 'N/A'}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Overall Score</span>
            </div>
          </div>

          {/* Progress indicators */}
          {selectedCandidate.score && selectedCandidate.score > 0 && selectedCandidate.summary ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Skills Fit</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${selectedCandidate.details?.skills_feedback ? 85 : 75}%`, height: '100%', background: 'var(--color-primary)' }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>Match</span>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Experience Fit</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${selectedCandidate.score >= 80 ? 90 : selectedCandidate.score >= 50 ? 60 : 35}%`, height: '100%', background: 'var(--color-success)' }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>Fit</span>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Education Fit</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '80%', height: '100%', background: 'var(--color-warning)' }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>Match</span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Detailed report & resume text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
            {selectedCandidate.summary ? (
              <>
                <div className="glass-card" style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.4)', overflowY: 'auto', maxHeight: '350px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-primary)' }}>
                    <Layers size={14} /> Agent Evaluation Report
                  </div>
                  <div className="evaluation-markdown" style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                    {selectedCandidate.summary.split('\n').map((line, i) => {
                      if (line.startsWith('### ')) {
                        return <h4 key={i} style={{ color: 'var(--text-primary)', marginTop: '16px', marginBottom: '6px', fontSize: '0.9rem' }}>{line.replace('### ', '')}</h4>;
                      }
                      if (line.startsWith('- ')) {
                        return <li key={i} style={{ marginLeft: '12px', marginBottom: '4px' }}>{line.replace('- ', '')}</li>;
                      }
                      return <p key={i} style={{ margin: '0 0 8px 0' }}>{line}</p>;
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Full Resume Context</span>
                  <pre style={{ margin: 0, padding: '14px', background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-glass)', borderRadius: '8px', overflowY: 'auto', maxHeight: '200px', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {selectedCandidate.resume}
                  </pre>
                </div>
              </>
            ) : (
              <>
                {/* Info banner */}
                <div style={{ display: 'flex', gap: '10px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.15)', padding: '12px 16px', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  <Info size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Raw Candidate Profile Loaded:</strong> This candidate has not been screened against a Job Description yet. Paste a JD above and click <em>Run Agentic Screener</em> to evaluate and grade them.
                  </div>
                </div>

                {/* Full resume context taking up remaining space */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: '300px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Full Resume Context</span>
                  <pre style={{ margin: 0, padding: '14px', background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-glass)', borderRadius: '8px', overflowY: 'auto', flex: 1, fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {selectedCandidate.resume}
                  </pre>
                </div>
              </>
            )}
          </div>

        </section>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', flex: 1 }} className="glass-card">
          <Database size={48} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.6 }} />
          <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Ready for Screening</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', maxWidth: '360px', marginTop: '8px', lineHeight: '1.5' }}>
            Paste a Job Description and click <strong>Run Agentic Screener</strong> to evaluate candidates. Or search and select a candidate in the sidebar to review their raw resume.
          </p>
        </div>
      )}
    </div>
  );
}

