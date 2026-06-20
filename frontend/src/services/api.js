const API_BASE = "http://127.0.0.1:8000";

export const api = {
  async fetchCandidates() {
    const res = await fetch(`${API_BASE}/api/candidates`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to fetch candidates");
    }
    return res.json();
  },

  async uploadResume(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Ingestion failed");
    }
    return data;
  },

  async screenResumes(jobDescription, limit) {
    const res = await fetch(`${API_BASE}/api/screen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_description: jobDescription,
        limit: limit
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Screening process failed");
    }
    return data;
  },

  async chatCandidatesStream({ query, chatHistory, candidateIds, onChunk, onError }) {
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          chat_history: chatHistory.map(m => ({
            role: m.role,
            content: m.content
          })),
          candidate_ids: candidateIds
        })
      });

      if (!response.ok) {
        throw new Error("Chat server error");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value, { stream: !done });
        accumulated += chunk;
        onChunk(accumulated);
      }
    } catch (err) {
      onError(err);
    }
  }
};
