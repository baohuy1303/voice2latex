"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PdfPanel from "./components/PdfPanel";
import EditorPanel from "./components/EditorPanel";
import LatexPreview from "./components/LatexPreview";
import SiriBubble from "./components/SiriBubble";
import ContextTray, { ContextSnippet } from "./components/ContextTray";
import SelectionPopup from "./components/SelectionPopup";
import {
  sendChatMessage,
  transcribeAudio,
  createSession,
  getSession,
  listSessions,
  uploadPdf,
  deleteSession,
  compileToPdf,
  fetchSessionPdf,
} from "./lib/api";
import useMicrophone from "./hooks/useMicrophone";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

let snippetCounter = 0;

export default function Home() {
  const [document, setDocument] = useState("");
  const [documentHistory, setDocumentHistory] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Array<{ id: string; updated_at: string }>>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [contextSnippets, setContextSnippets] = useState<ContextSnippet[]>([]);
  const [pendingDocument, setPendingDocument] = useState<string | null>(null);
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [previewFontSize, setPreviewFontSize] = useState(16);
  const { isRecording, startRecording, stopRecording } = useMicrophone();
  const [mode, setMode] = useState<"edit" | "tutor">("edit");
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compiledPdfFile, setCompiledPdfFile] = useState<File | null>(null);
  const [previewTab, setPreviewTab] = useState<"katex" | "pdf">("katex");
  const [voicePhase, setVoicePhase] = useState<"idle" | "transcribing" | "thinking">("idle");
  const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false);
  const sessionDropdownRef = useRef<HTMLDivElement>(null);

  // Panel widths as percentages
  const [panelWidths, setPanelWidths] = useState([25, 40, 35]);
  const isDraggingDivider = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewPanelRef = useRef<HTMLDivElement>(null);

  const formatSessionId = (id: string) => {
    // Expected: YYYYMMDD_HHMMSS
    if (/^\d{8}_\d{6}/.test(id)) {
      const year = id.slice(0, 4);
      const month = id.slice(4, 6);
      const day = id.slice(6, 8);
      const hour = id.slice(9, 11);
      const min = id.slice(11, 13);
      const sec = id.slice(13, 15);
      
      const date = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
      return date.toLocaleString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: 'numeric' 
      });
    }
    return id;
  };

  // Close session dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(e.target as Node)) {
        setSessionDropdownOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  // --- Draggable dividers ---
  const handleDividerMouseDown = useCallback((dividerIndex: number) => {
    isDraggingDivider.current = dividerIndex;
    window.document.body.style.cursor = "col-resize";
    window.document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingDivider.current === null || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      const idx = isDraggingDivider.current;

      setPanelWidths((prev) => {
        const next = [...prev];
        if (idx === 0) {
          // Dragging between panel 0 and 1
          const newLeft = Math.max(10, Math.min(50, pct));
          const diff = newLeft - next[0];
          next[0] = newLeft;
          next[1] = Math.max(15, next[1] - diff);
        } else {
          // Dragging between panel 1 and 2
          const newBoundary = Math.max(next[0] + 15, Math.min(90, pct));
          next[1] = newBoundary - next[0];
          next[2] = Math.max(10, 100 - newBoundary);
        }
        return next;
      });
    };

    const handleMouseUp = () => {
      if (isDraggingDivider.current !== null) {
        isDraggingDivider.current = null;
        window.document.body.style.cursor = "";
        window.document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // --- Context snippets ---
  const addContextSnippet = useCallback((source: "pdf" | "editor" | "preview", text: string) => {
    const id = `ctx-${++snippetCounter}`;
    setContextSnippets((prev) => [...prev, { id, source, text }]);
  }, []);

  const removeContextSnippet = useCallback((id: string) => {
    setContextSnippets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearAllContext = useCallback(() => {
    setContextSnippets([]);
  }, []);

  // Build context string from all snippets
  const getContextString = useCallback(() => {
    if (contextSnippets.length === 0) return undefined;
    return contextSnippets
      .map((s) => `[From ${s.source}]: ${s.text}`)
      .join("\n\n");
  }, [contextSnippets]);

  // --- Sessions ---
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
          const pdf = await fetchSessionPdf(state.id);
          if (pdf) setPdfFile(pdf);
          await refreshSessions();
          return;
        } catch { /* create new */ }
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
    setContextSnippets([]);
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
      setContextSnippets([]);
      setPendingDocument(null);
      const pdf = await fetchSessionPdf(state.id);
      setPdfFile(pdf);
      localStorage.setItem("voice2latex_session", state.id);
    } catch { /* not found */ }
  }, []);

  const handleClearSession = useCallback(() => {
    setDocument("");
    setMessages([]);
    setDocumentHistory([]);
    setContextSnippets([]);
    setPendingDocument(null);
  }, []);

  const handleDeleteSession = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this session?")) return;
    try {
      await deleteSession(id);
      if (sessionId === id) {
        handleClearSession();
        setSessionId(null);
        localStorage.removeItem("voice2latex_session");
      }
      await refreshSessions();
    } catch { /* error */ }
  }, [sessionId, handleClearSession, refreshSessions]);

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

  // --- Chat ---
  const handleSend = useCallback(
    async (message: string, imagesBase64?: string[]) => {
      if (!message.trim() || isLoading) return;

      setMessages((prev) => [...prev, { role: "user", content: message }]);
      setIsLoading(true);

      try {
        const res = await sendChatMessage(
          message,
          document,
          sessionId || undefined,
          getContextString(),
          mode,
          imagesBase64
        );

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.reply },
        ]);

        if (res.action !== "no_change" && res.new_document !== document) {
          setPendingDocument(res.new_document);
        }

        clearAllContext();
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error: Could not reach the server." },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [document, sessionId, getContextString, isLoading, clearAllContext, mode]
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

  // --- Voice ---
  const handleMicToggle = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob || blob.size < 1000) return;
      setVoicePhase("transcribing");
      setIsLoading(true);
      try {
        const transcript = await transcribeAudio(blob);
        if (!transcript) { setVoicePhase("idle"); setIsLoading(false); return; }
        setVoicePhase("thinking");
        await handleSend(transcript);
        setVoicePhase("idle");
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "Error: Could not process voice." }]);
        setVoicePhase("idle");
        setIsLoading(false);
      }
    } else {
      await startRecording();
    }
  }, [isRecording, stopRecording, startRecording, handleSend]);

  const handleCompile = useCallback(async () => {
    setIsCompiling(true);
    setCompileError(null);
    try {
      const blob = await compileToPdf(document);

      setCompiledPdfFile(new File([blob], "compiled.pdf", { type: "application/pdf" }));
      setPreviewTab("pdf");

      // Trigger download — revoke immediately after click, display uses the File
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = "document.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Compile error:", err);
      setCompileError(err instanceof Error ? err.message : "Compile failed");
    } finally {
      setIsCompiling(false);
    }
  }, [document]);

  const handlePdfUpload = useCallback(
    async (file: File) => {
      setPdfFile(file);
      if (sessionId) await uploadPdf(sessionId, file);
    },
    [sessionId]
  );

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="relative flex items-center justify-between px-4 py-0 border-b border-zinc-800/60 bg-zinc-950 shrink-0" style={{ minHeight: 48 }}>
        {/* Subtle top gradient line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

        {/* Left: Logo */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/40 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
              <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
              <path d="M6 10a1 1 0 0 0-2 0 8 8 0 0 0 7 7.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.07A8 8 0 0 0 20 10a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z" />
            </svg>
          </div>
          <h1 className="text-sm font-bold tracking-tight">
            <span className="text-zinc-100">Voice</span>
            <span className="text-indigo-400">2</span>
            <span className="text-zinc-100">LaTeX</span>
          </h1>
        </div>

        {/* Center: Mode toggle — layoutId pill */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-zinc-900 rounded-xl p-1 border border-zinc-800/80 gap-0.5 shadow-inner">
          {(["edit", "tutor"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="relative px-6 py-1.5 text-xs font-semibold rounded-lg focus:outline-none"
            >
              {mode === m && (
                <motion.div
                  layoutId="mode-pill"
                  className={`absolute inset-0 rounded-lg shadow-md ${m === "edit" ? "bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-indigo-900/40" : "bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-900/40"}`}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 transition-colors duration-150 ${mode === m ? "text-white drop-shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}>
                {m === "edit" ? "✏️ Edit" : "🎓 Tutor"}
              </span>
            </button>
          ))}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
          {/* Session picker — custom dropdown */}
          <div ref={sessionDropdownRef} className="relative">
            <button
              onClick={() => setSessionDropdownOpen((o) => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors max-w-[160px]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-zinc-500 shrink-0">
                <path d="M10 2a.75.75 0 0 1 .75.75v.258a33.186 33.186 0 0 1 6.668.83.75.75 0 0 1-.336 1.461 31.28 31.28 0 0 0-1.103-.232l1.702 7.545a.75.75 0 0 1-.387.832A4.981 4.981 0 0 1 15 14c-.825 0-1.606-.2-2.294-.556a.75.75 0 0 1-.387-.832l1.77-7.849a31.743 31.743 0 0 0-3.339-.254V15h1.25a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1 0-1.5H9.25V4.509a31.742 31.742 0 0 0-3.34.254l1.771 7.849a.75.75 0 0 1-.387.832A4.98 4.98 0 0 1 5 14a4.98 4.98 0 0 1-2.294-.556.75.75 0 0 1-.387-.832L4.021 5.067c-.37.07-.738.148-1.103.232a.75.75 0 0 1-.336-1.461 33.186 33.186 0 0 1 6.668-.83V2.75A.75.75 0 0 1 10 2Z" />
              </svg>
              <span className="truncate">{sessionId ? formatSessionId(sessionId) : "No session"}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3 h-3 text-zinc-600 shrink-0 transition-transform duration-150 ${sessionDropdownOpen ? "rotate-180" : ""}`}>
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
            <AnimatePresence>
              {sessionDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute right-0 top-full mt-1.5 w-52 bg-zinc-900 border border-zinc-800/80 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50"
                >
                  <div className="max-h-52 overflow-y-auto py-1">
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { handleLoadSession(s.id); setSessionDropdownOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left ${s.id === sessionId ? "bg-indigo-600/20 text-indigo-300" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}
                      >
                        <span className="truncate">{formatSessionId(s.id)}</span>
                        {s.id === sessionId && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-indigo-400 shrink-0 ml-2">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-zinc-800/80 py-1">
                    <button
                      onClick={() => { handleNewSession(); setSessionDropdownOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                      </svg>
                      New session
                    </button>
                    {sessionId && (
                      <button
                        onClick={(e) => { handleDeleteSession(e, sessionId); setSessionDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:bg-red-950/40 hover:text-red-400 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                        </svg>
                        Delete current
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-zinc-800/80 mx-0.5" />

          <button onClick={handleClearSession} className="px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors border border-zinc-800/80 text-zinc-500 hover:text-zinc-300">
            Clear
          </button>
          <button onClick={handleUndo} disabled={documentHistory.length === 0} className="px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 transition-colors border border-zinc-800/80 text-zinc-500 hover:text-zinc-300">
            Undo
          </button>
          <motion.button
            onClick={handleCompile}
            disabled={isCompiling || !document.trim()}
            whileTap={{ scale: 0.97 }}
            className={`flex items-center px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-30 transition-colors border text-white overflow-hidden ${isCompiling ? "bg-indigo-700 border-indigo-600/50 shimmer" : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border-indigo-500/40 shadow-lg shadow-indigo-900/20"}`}
          >
            <AnimatePresence mode="wait">
              {isCompiling ? (
                <motion.span key="compiling" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                  Compiling...
                </motion.span>
              ) : (
                <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M10 2a.75.75 0 0 1 .75.75v.258a33.186 33.186 0 0 1 6.668.83.75.75 0 0 1-.336 1.461 31.28 31.28 0 0 0-1.103-.232l1.702 7.545a.75.75 0 0 1-.387.832A4.981 4.981 0 0 1 15 14c-.825 0-1.606-.2-2.294-.556a.75.75 0 0 1-.387-.832l1.77-7.849a31.743 31.743 0 0 0-3.339-.254V15h1.25a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1 0-1.5H9.25V4.509a31.742 31.742 0 0 0-3.34.254l1.771 7.849a.75.75 0 0 1-.387.832A4.98 4.98 0 0 1 5 14a4.98 4.98 0 0 1-2.294-.556.75.75 0 0 1-.387-.832L4.021 5.067c-.37.07-.738.148-1.103.232a.75.75 0 0 1-.336-1.461 33.186 33.186 0 0 1 6.668-.83V2.75A.75.75 0 0 1 10 2Z" clipRule="evenodd" />
                  </svg>
                  Compile
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </header>
      <AnimatePresence>
        {compileError && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden shrink-0"
          >
            <div className="px-4 py-2 text-xs text-red-400 font-mono bg-red-950/30 border-b border-red-900/30">
              {compileError}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3-Panel Layout with draggable dividers */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden relative" style={{ zIndex: 1 }}>
        {/* Left: PDF Viewer */}
        <div className="flex flex-col bg-zinc-900/30 overflow-hidden" style={{ width: `${panelWidths[0]}%` }}>
          <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800/80 font-medium uppercase tracking-wider bg-zinc-900/50 flex items-center justify-between shrink-0">
            <span>PDF Viewer</span>
            {pdfFile && (
              <span className="text-[10px] text-zinc-600 truncate max-w-[100px]">{pdfFile.name}</span>
            )}
          </div>
          <PdfPanel
            file={pdfFile}
            onFileUpload={handlePdfUpload}
            onTextSelected={(text) => addContextSnippet("pdf", text)}
            className="flex-1 min-h-0 overflow-hidden"
          />
        </div>

        {/* Divider 1 */}
        <div
          className="w-1 bg-zinc-800/80 hover:bg-indigo-500/50 cursor-col-resize shrink-0 transition-colors"
          onMouseDown={() => handleDividerMouseDown(0)}
        />

        {/* Middle: Monaco Editor */}
        <div className={`flex flex-col overflow-hidden relative ${pendingDocument ? "ai-glow" : ""}`} style={{ width: `${panelWidths[1]}%` }}>
          <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800/80 font-medium uppercase tracking-wider bg-zinc-900/50 flex items-center justify-between shrink-0">
            <AnimatePresence mode="wait">
              {pendingDocument ? (
                <motion.div key="review" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="flex items-center gap-2">
                  <span>Review Changes</span>
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 350, damping: 20 }} className="text-[10px] text-amber-400 font-medium normal-case tracking-normal bg-amber-950/40 border border-amber-800/30 px-1.5 py-0.5 rounded">Pending</motion.span>
                </motion.div>
              ) : (
                <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center gap-2">
                  <span>Editor</span>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex items-center gap-1">
              <button onClick={() => setEditorFontSize((s) => Math.max(10, s - 2))} className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">-</button>
              <span className="text-[9px] text-zinc-600 w-5 text-center">{editorFontSize}</span>
              <button onClick={() => setEditorFontSize((s) => Math.min(28, s + 2))} className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">+</button>
            </div>
          </div>
          <EditorPanel
            value={document}
            onChange={(val) => { pushHistory(document); setDocument(val); }}
            proposedValue={pendingDocument}
            onAccept={handleAcceptDiff}
            onReject={handleRejectDiff}
            fontSize={editorFontSize}
            className="flex-1"
          />
        </div>

        {/* Divider 2 */}
        <div
          className="w-1 bg-zinc-800/80 hover:bg-indigo-500/50 cursor-col-resize shrink-0 transition-colors"
          onMouseDown={() => handleDividerMouseDown(1)}
        />

        {/* Right: Preview (KaTeX / PDF) */}
        <div ref={previewPanelRef} className="flex flex-col overflow-hidden relative" style={{ width: `${panelWidths[2]}%` }}>
          <div className="px-3 py-2 text-xs border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPreviewTab("katex")}
                className={`px-2 py-0.5 rounded font-medium uppercase tracking-wider transition-colors ${previewTab === "katex" ? "text-zinc-200 bg-zinc-700/60" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Preview
              </button>
              <button
                onClick={() => setPreviewTab("pdf")}
                className={`px-2 py-0.5 rounded font-medium uppercase tracking-wider transition-colors ${previewTab === "pdf" ? "text-zinc-200 bg-zinc-700/60" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                PDF
              </button>
            </div>
            {previewTab === "katex" && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPreviewFontSize((s) => Math.max(10, s - 2))} className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">-</button>
                <span className="text-[9px] text-zinc-600 w-5 text-center">{previewFontSize}</span>
                <button onClick={() => setPreviewFontSize((s) => Math.min(32, s + 2))} className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">+</button>
              </div>
            )}
          </div>
          <AnimatePresence mode="wait">
            {previewTab === "katex" ? (
              <motion.div key="katex" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <LatexPreview
                  latex={pendingDocument || document}
                  fontSize={previewFontSize}
                  className="flex-1 bg-zinc-900/40 overflow-auto latex-preview"
                />
                <SelectionPopup containerRef={previewPanelRef} source="preview" onSendToAI={addContextSnippet} />
              </motion.div>
            ) : compiledPdfFile ? (
              <motion.div key="pdf" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }} className="flex-1 min-h-0 overflow-hidden">
                <PdfPanel
                  file={compiledPdfFile}
                  onFileUpload={() => {}}
                  className="h-full overflow-hidden"
                />
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col items-center justify-center text-zinc-600 text-xs gap-2">
                <span>No PDF compiled yet</span>
                <span className="text-zinc-700">Click &quot;Compile &amp; Download&quot; to generate</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Context Tray */}
      <ContextTray
        snippets={contextSnippets}
        onRemove={removeContextSnippet}
        onClearAll={clearAllContext}
      />

      {/* Floating Siri Bubble */}
      <SiriBubble
        messages={messages}
        isLoading={isLoading}
        isRecording={isRecording}
        onMicToggle={handleMicToggle}
        onSend={handleSend}
        pdfContext={contextSnippets.length > 0 ? `${contextSnippets.length} context(s) attached` : null}
        onClearContext={clearAllContext}
        voicePhase={voicePhase}
      />
    </div>
  );
}
