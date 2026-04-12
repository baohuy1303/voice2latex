"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import PdfPanel from "./components/PdfPanel";
import EditorPanel from "./components/EditorPanel";
import LatexPreview from "./components/LatexPreview";
import {
  sendChatMessage,
  transcribeAudio,
  createSession,
  getSession,
  saveSession,
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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfContext, setPdfContext] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const { isRecording, startRecording, stopRecording, error: micError } = useMicrophone();
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize session on mount
  useEffect(() => {
    async function init() {
      const savedId = localStorage.getItem("voice2latex_session");
      if (savedId) {
        try {
          const state = await getSession(savedId);
          setSessionId(state.id);
          setDocument(state.document);
          return;
        } catch {
          // Session not found, create new
        }
      }
      const state = await createSession();
      setSessionId(state.id);
      localStorage.setItem("voice2latex_session", state.id);
    }
    init();
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
          pushHistory(document);
          setDocument(res.new_document);
        }

        // Clear PDF context after use
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
    [document, sessionId, pdfContext, pushHistory, isLoading]
  );

  const handleMicToggle = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob) return;

      setIsLoading(true);
      try {
        const transcript = await transcribeAudio(blob);
        if (transcript) {
          await handleSend(transcript);
        }
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

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      handleSend(chatInput.trim());
      setChatInput("");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/80 bg-zinc-900/95 backdrop-blur-sm shrink-0">
        <h1 className="text-lg font-semibold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          Voice2LaTeX
        </h1>
        <div className="flex items-center gap-2">
          {sessionId && (
            <span className="text-[10px] text-zinc-600 font-mono">
              {sessionId}
            </span>
          )}
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
      <div className="flex flex-1 overflow-hidden">
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

        {/* Middle: Monaco Editor */}
        <div className="w-[40%] border-r border-zinc-800/80 flex flex-col">
          <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800/80 font-medium uppercase tracking-wider bg-zinc-900/50">
            Editor
          </div>
          <EditorPanel
            value={document}
            onChange={(val) => {
              pushHistory(document);
              setDocument(val);
            }}
            className="flex-1"
          />
        </div>

        {/* Right: KaTeX Preview */}
        <div className="w-[35%] flex flex-col">
          <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800/80 font-medium uppercase tracking-wider bg-zinc-900/50">
            Preview
          </div>
          <LatexPreview
            latex={document}
            className="flex-1 bg-zinc-900/40 overflow-auto latex-preview"
          />
        </div>
      </div>

      {/* Bottom: Temporary Chat Bar (replaced by Siri Bubble in Phase 4) */}
      <div className="shrink-0 border-t border-zinc-800/80 bg-zinc-900/95 backdrop-blur-sm px-4 py-2.5">
        {/* PDF context badge */}
        {pdfContext && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-blue-400 font-medium">Context:</span>
            <span className="text-xs text-zinc-400 truncate max-w-md">
              &ldquo;{pdfContext.slice(0, 80)}...&rdquo;
            </span>
            <button
              onClick={() => setPdfContext(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              x
            </button>
          </div>
        )}

        {/* Messages row */}
        {messages.length > 0 && (
          <div className="flex gap-3 mb-2 overflow-x-auto">
            {messages.slice(-3).map((msg, i) => (
              <span
                key={i}
                className={`text-xs shrink-0 px-2 py-1 rounded ${
                  msg.role === "user"
                    ? "bg-blue-600/20 text-blue-300"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {msg.content.slice(0, 60)}{msg.content.length > 60 ? "..." : ""}
              </span>
            ))}
          </div>
        )}

        <form onSubmit={handleChatSubmit} className="flex gap-2 items-center">
          {/* Mic button */}
          <button
            type="button"
            onClick={handleMicToggle}
            disabled={isLoading}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all disabled:opacity-40 ${
              isRecording
                ? "bg-red-500 mic-recording"
                : "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50"
            }`}
          >
            {isRecording ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-zinc-400">
                <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
                <path d="M6 10a1 1 0 0 0-2 0 8 8 0 0 0 7 7.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.07A8 8 0 0 0 20 10a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z" />
              </svg>
            )}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={isRecording ? "Listening..." : "Type a command..."}
            disabled={isLoading || isRecording}
            className="flex-1 bg-zinc-800 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500 disabled:opacity-50 border border-zinc-700/50"
          />

          <button
            type="submit"
            disabled={isLoading || !chatInput.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </form>

        {micError && (
          <p className="text-xs text-red-400 mt-1">{micError}</p>
        )}
      </div>
    </div>
  );
}
