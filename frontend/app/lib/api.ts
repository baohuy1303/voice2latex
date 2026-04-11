const API_BASE = "http://localhost:8000/api";

export interface AgentResponse {
  action: "replace_all" | "insert" | "replace_snippet" | "no_change";
  new_document: string;
  reply: string;
  explanation?: string;
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
