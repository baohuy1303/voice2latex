"use client";

import { useState, useCallback, useEffect } from "react";
import PdfPanel from "./components/PdfPanel";
import EditorPanel from "./components/EditorPanel";
import LatexPreview from "./components/LatexPreview";
import SiriBubble from "./components/SiriBubble";
import {
  sendChatMessage,
  transcribeAudio,
  createSession,
  getSession,
  listSessions,
  uploadPdf,
} from "./lib/api";
import useMicrophone from "./hooks/useMicrophone";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [document, setDocument] = useState("");
  const [documentHistory, setDocumentHistory] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Array<{ id: string; updated_at: string }>>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfContext, setPdfContext] = useState<string | null>(null);
  const [pendingDocument, setPendingDocument] = useState<string | null>(null);
  const { isRecording, startRecording, stopRecording } = useMicrophone();

  const refreshSessions = useCallback(async () => {
    const list = await listSessions();
    setSessions(list);
  }, []);

  useEffect(() => {
    async function init() {
      const savedId = localStorage.getItem("voice2latex_session");
      if (savedId) {
        try {
          const state = await getSession(savedId);
          setSessionId(state.id);
          setDocument(state.document);
          setMessages(
            (state.history || []).map((h: { role: string; content: string }) => ({
              role: h.role === "model" ? "assistant" as const : "user" as const,
              content: h.content,
            }))
          );
          await refreshSessions();
          return;
        } catch {
          // Session not found
        }
      }
      const state = await createSession();
      setSessionId(state.id);
      localStorage.setItem("voice2latex_session", state.id);
      await refreshSessions();
    }
    init();
  }, [refreshSessions]);

  const handleNewSession = useCallback(async () => {
    const state = await createSession();
    setSessionId(state.id);
    setDocument("");
    setMessages([]);
    setDocumentHistory([]);
    setPdfFile(null);
    setPdfContext(null);
    setPendingDocument(null);
    localStorage.setItem("voice2latex_session", state.id);
    await refreshSessions();
  }, [refreshSessions]);

  const handleLoadSession = useCallback(async (id: string) => {
    try {
      const state = await getSession(id);
      setSessionId(state.id);
      setDocument(state.document);
      setMessages(
        (state.history || []).map((h: { role: string; content: string }) => ({
          role: h.role === "model" ? "assistant" as const : "user" as const,
          content: h.content,
        }))
      );
      setDocumentHistory([]);
      setPdfFile(null);
      setPdfContext(null);
      setPendingDocument(null);
      localStorage.setItem("voice2latex_session", state.id);
    } catch {
      // Session not found
    }
  }, []);

  const handleClearSession = useCallback(() => {
    setDocument("");
    setMessages([]);
    setDocumentHistory([]);
    setPdfContext(null);
    setPendingDocument(null);
  }, []);

  const pushHistory = useCallback((doc: string) => {
    setDocumentHistory((prev) => [...prev.slice(-49), doc]);
  }, []);

  const handleUndo = useCallback(() => {
    setDocumentHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setDocument(last);
      return prev.slice(0, -1);
    });
  }, []);

  const handleSend = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading) return;

      setMessages((prev) => [...prev, { role: "user", content: message }]);
      setIsLoading(true);

      try {
        const res = await sendChatMessage(
          message,
          document,
          sessionId || undefined,
          pdfContext || undefined
        );

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.reply },
        ]);

        if (res.action !== "no_change" && res.new_document !== document) {
          setPendingDocument(res.new_document);
        }

        setPdfContext(null);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error: Could not reach the server." },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [document, sessionId, pdfContext, isLoading]
  );

  const handleAcceptDiff = useCallback(() => {
    if (!pendingDocument) return;
    pushHistory(document);
    setDocument(pendingDocument);
    setPendingDocument(null);
  }, [pendingDocument, document, pushHistory]);

  const handleRejectDiff = useCallback(() => {
    setPendingDocument(null);
  }, []);

  const handleMicToggle = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob || blob.size < 1000) return;

      setIsLoading(true);
      try {
        const transcript = await transcribeAudio(blob);
        if (!transcript) {
          setIsLoading(false);
          return;
        }
        setIsLoading(false);
        await handleSend(transcript);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error: Could not process voice." },
        ]);
        setIsLoading(false);
      }
    } else {
      await startRecording();
    }
  }, [isRecording, stopRecording, startRecording, handleSend]);

  const handlePdfUpload = useCallback(
    async (file: File) => {
      setPdfFile(file);
      if (sessionId) {
        await uploadPdf(sessionId, file);
      }
    },
    [sessionId]
  );

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/80 bg-zinc-900/95 backdrop-blur-sm shrink-0">
        <h1 className="text-lg font-semibold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          Voice2LaTeX
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={sessionId || ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "__new__") handleNewSession();
              else if (val) handleLoadSession(val);
            }}
            className="bg-zinc-800 text-zinc-400 text-xs rounded-md px-2 py-1.5 outline-none border border-zinc-700/50 cursor-pointer hover:border-zinc-600"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                Session {s.id}
              </option>
            ))}
            <option value="__new__">+ New session</option>
          </select>
          <button
            onClick={handleClearSession}
            className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700/50"
          >
            Clear
          </button>
          <button
            onClick={handleUndo}
            disabled={documentHistory.length === 0}
            className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 transition-colors border border-zinc-700/50"
          >
            Undo
          </button>
        </div>
      </header>

      {/* 3-Panel Layout */}
      <div className="flex flex-1 overflow-hidden relative" style={{ zIndex: 1 }}>
        {/* Left: PDF Viewer */}
        <div className="w-[25%] min-w-[200px] border-r border-zinc-800/80 flex flex-col bg-zinc-900/30">
          <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800/80 font-medium uppercase tracking-wider bg-zinc-900/50 flex items-center justify-between">
            <span>PDF Viewer</span>
            {pdfFile && (
              <span className="text-[10px] text-zinc-600 truncate max-w-[120px]">
                {pdfFile.name}
              </span>
            )}
          </div>
          <PdfPanel
            file={pdfFile}
            onFileUpload={handlePdfUpload}
            onTextSelected={(text) => setPdfContext(text)}
            className="flex-1"
          />
        </div>

        {/* Middle: Monaco Editor (with diff mode) */}
        <div className="w-[40%] border-r border-zinc-800/80 flex flex-col">
          <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800/80 font-medium uppercase tracking-wider bg-zinc-900/50 flex items-center justify-between">
            <span>{pendingDocument ? "Review Changes" : "Editor"}</span>
            {pendingDocument && (
              <span className="text-[10px] text-amber-400 font-medium">
                Pending changes
              </span>
            )}
          </div>
          <EditorPanel
            value={document}
            onChange={(val) => {
              pushHistory(document);
              setDocument(val);
            }}
            proposedValue={pendingDocument}
            onAccept={handleAcceptDiff}
            onReject={handleRejectDiff}
            className="flex-1"
          />
        </div>

        {/* Right: KaTeX Preview */}
        <div className="w-[35%] flex flex-col">
          <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800/80 font-medium uppercase tracking-wider bg-zinc-900/50">
            Preview
          </div>
          <LatexPreview
            latex={pendingDocument || document}
            className="flex-1 bg-zinc-900/40 overflow-auto latex-preview"
          />
        </div>
      </div>

      {/* Floating Siri Bubble */}
      <SiriBubble
        messages={messages}
        isLoading={isLoading}
        isRecording={isRecording}
        onMicToggle={handleMicToggle}
        onSend={handleSend}
        pdfContext={pdfContext}
        onClearContext={() => setPdfContext(null)}
      />
    </div>
  );
}
