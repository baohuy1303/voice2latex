const API_BASE = "http://localhost:8000/api";

export interface AgentResponse {
  action: "replace_all" | "insert" | "replace_snippet" | "no_change";
  new_document: string;
  reply: string;
  explanation?: string;
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");

  const res = await fetch(`${API_BASE}/voice/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Transcription error: ${res.status}`);
  }

  const data = await res.json();
  return data.transcript;
}

export async function sendChatMessage(
  message: string,
  document: string
): Promise<AgentResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, document }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}
