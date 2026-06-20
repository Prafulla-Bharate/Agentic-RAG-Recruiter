import React, { useRef, useEffect } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { api } from '../services/api';

export default function ChatWorkspace({
  candidates,
  chatHistory,
  setChatHistory,
  isChatting,
  setIsChatting,
  setAppError
}) {
  const [chatInput, setChatInput] = React.useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const userMessage = chatInput;
    setChatInput("");
    
    // Add User Message
    const updatedHistory = [...chatHistory, { role: 'user', content: userMessage }];
    setChatHistory(updatedHistory);
    setIsChatting(true);

    // Placeholder message for model response streaming
    setChatHistory(prev => [...prev, { role: 'model', content: "" }]);

    try {
      await api.chatCandidatesStream({
        query: userMessage,
        chatHistory: updatedHistory,
        candidateIds: candidates.map(c => c.id),
        onChunk: (accumulatedText) => {
          setChatHistory(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'model', content: accumulatedText };
            return updated;
          });
        },
        onError: (err) => {
          setChatHistory(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'model', content: `Failed to fetch response: ${err.message}` };
            return updated;
          });
        }
      });
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <aside className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ borderBottom: '1px solid var(--border-glass)', padding: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={18} color="var(--color-primary)" />
        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>AI Recruiter Workspace</h3>
      </div>

      {/* CHAT WINDOW MESSAGE LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {chatHistory.map((msg, i) => (
          <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div 
              style={{ 
                padding: '10px 14px', 
                borderRadius: '12px', 
                fontSize: '0.82rem',
                lineHeight: '1.4',
                background: msg.role === 'user' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.04)',
                color: msg.role === 'user' ? '#fff' : 'var(--text-secondary)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-glass)',
                borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                borderBottomLeftRadius: msg.role === 'user' ? '12px' : '2px',
              }}
            >
              {msg.content ? (
                msg.content.split('\n').map((para, idx) => <p key={idx} style={{ margin: '0 0 6px 0' }}>{para}</p>)
              ) : (
                <span className="cursor-blink">Typing</span>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* INPUT SUBMISSION */}
      <form onSubmit={handleChatSubmit} style={{ borderTop: '1px solid var(--border-glass)', padding: '12px', display: 'flex', gap: '8px' }}>
        <input 
          type="text" 
          value={chatInput} 
          onChange={(e) => setChatInput(e.target.value)} 
          placeholder="Ask about candidate strengths..." 
          className="glass-input" 
          style={{ flex: 1, fontSize: '0.8rem' }}
          disabled={isChatting}
        />
        <button 
          type="submit" 
          className="glass-btn" 
          style={{ padding: '8px 12px' }}
          disabled={isChatting}
        >
          <Send size={14} />
        </button>
      </form>
    </aside>
  );
}
