const API_BASE = "http://localhost:8000/api";

export interface AgentResponse {
  action: "replace_all" | "insert" | "replace_snippet" | "no_change";
  new_document: string;
  reply: string;
  explanation?: string;
}

export interface SessionState {
  id: string;
  document: string;
  history: Array<{ role: string; content: string }>;
  created_at: string;
  updated_at: string;
}

// --- Session CRUD ---

export async function createSession(): Promise<SessionState> {
  const res = await fetch(`${API_BASE}/session`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  return res.json();
}

export async function getSession(id: string): Promise<SessionState> {
  const res = await fetch(`${API_BASE}/session/${id}`);
  if (!res.ok) throw new Error(`Failed to get session: ${res.status}`);
  return res.json();
}

export async function saveSession(
  id: string,
  document: string,
  history: Array<{ role: string; content: string }>
): Promise<void> {
  await fetch(`${API_BASE}/session/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document, history }),
  });
}

export async function listSessions(): Promise<Array<{ id: string; updated_at: string }>> {
  const res = await fetch(`${API_BASE}/session`);
  if (!res.ok) return [];
  return res.json();
}

export async function uploadPdf(sessionId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  await fetch(`${API_BASE}/session/${sessionId}/upload`, {
    method: "POST",
    body: formData,
  });
}

export function getPdfUrl(sessionId: string): string {
  return `${API_BASE}/session/${sessionId}/pdf`;
}

// --- Chat ---

export async function sendChatMessage(
  message: string,
  document: string,
  sessionId?: string,
  context?: string
): Promise<AgentResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, document, session_id: sessionId, context }),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// --- Voice ---

export async function transcribeAudio(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");

  const res = await fetch(`${API_BASE}/voice/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error(`Transcription error: ${res.status}`);
  const data = await res.json();
  return data.transcript;
}
