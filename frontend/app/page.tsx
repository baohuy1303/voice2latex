"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import PdfPanel from "./components/PdfPanel";
import EditorPanel from "./components/EditorPanel";
import LatexPreview from "./components/LatexPreview";
import SiriBubble from "./components/SiriBubble";
import ContextTray, { ContextSnippet } from "./components/ContextTray";
import SelectionPopup from "./components/SelectionPopup";
import GraphCard from "./components/GraphCard";
import {
  buildGraphData,
  createGraphFunction,
  DEFAULT_GRAPH_VIEWPORT,
  extractPrimaryGraphExpression,
  getGraphCommandExpressions,
  GraphFunction,
  GraphRenderData,
  GraphViewport,
} from "./lib/graphing";
import {
  sendChatMessage,
  transcribeAudio,
  createSession,
  getSession,
  listSessions,
  uploadPdf,
  deleteSession,
  compileToPdf,
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
  const [graphFunctions, setGraphFunctions] = useState<GraphFunction[]>([]);
  const [graphViewport, setGraphViewport] = useState<GraphViewport>(DEFAULT_GRAPH_VIEWPORT);
  const [graphError, setGraphError] = useState<string | null>(null);
  const { isRecording, startRecording, stopRecording } = useMicrophone();
  const [mode, setMode] = useState<"edit" | "tutor">("edit");
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compiledPdfFile, setCompiledPdfFile] = useState<File | null>(null);
  const [previewTab, setPreviewTab] = useState<"katex" | "pdf">("katex");

  const activeDocument = pendingDocument || document;
  const graph = graphFunctions.length > 0 ? buildGraphData(graphFunctions, graphViewport) : null;

  const [panelWidths, setPanelWidths] = useState([25, 40, 35]);
  const isDraggingDivider = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewPanelRef = useRef<HTMLDivElement>(null);

  const formatSessionId = (id: string) => {
    if (/^\d{8}_\d{6}/.test(id)) {
      const year = id.slice(0, 4);
      const month = id.slice(4, 6);
      const day = id.slice(6, 8);
      const hour = id.slice(9, 11);
      const min = id.slice(11, 13);
      const sec = id.slice(13, 15);

      const date = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      });
    }
    return id;
  };

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
          const newLeft = Math.max(10, Math.min(50, pct));
          const diff = newLeft - next[0];
          next[0] = newLeft;
          next[1] = Math.max(15, next[1] - diff);
        } else {
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

  const getContextString = useCallback(() => {
    if (contextSnippets.length === 0) return undefined;
    return contextSnippets.map((s) => `[From ${s.source}]: ${s.text}`).join("\n\n");
  }, [contextSnippets]);

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
              role: h.role === "model" ? ("assistant" as const) : ("user" as const),
              content: h.content,
            }))
          );
          await refreshSessions();
          return;
        } catch {
          // create new
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
    setContextSnippets([]);
    setPendingDocument(null);
    setGraphFunctions([]);
    setGraphViewport(DEFAULT_GRAPH_VIEWPORT);
    setGraphError(null);
    setCompiledPdfFile(null);
    setPreviewTab("katex");
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
          role: h.role === "model" ? ("assistant" as const) : ("user" as const),
          content: h.content,
        }))
      );
      setDocumentHistory([]);
      setPdfFile(null);
      setContextSnippets([]);
      setPendingDocument(null);
      setGraphFunctions([]);
      setGraphViewport(DEFAULT_GRAPH_VIEWPORT);
      setGraphError(null);
      setCompiledPdfFile(null);
      setPreviewTab("katex");
      localStorage.setItem("voice2latex_session", state.id);
    } catch {
      // not found
    }
  }, []);

  const handleClearSession = useCallback(() => {
    setDocument("");
    setMessages([]);
    setDocumentHistory([]);
    setContextSnippets([]);
    setPendingDocument(null);
    setGraphFunctions([]);
    setGraphViewport(DEFAULT_GRAPH_VIEWPORT);
    setGraphError(null);
    setCompiledPdfFile(null);
    setPreviewTab("katex");
  }, []);

  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, id: string) => {
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
      } catch {
        // ignore
      }
    },
    [sessionId, handleClearSession, refreshSessions]
  );

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

  const addGraphExpressions = useCallback((expressions: string[]) => {
    if (expressions.length === 0) {
      setGraphError("I couldn't find a simple y = f(x) expression to graph.");
      return {
        ok: false as const,
        message: "I couldn't find a graphable function. Try `graph y = x^2` or use Graph Current.",
      };
    }

    try {
      setGraphFunctions((prev) => {
        const next = [...prev];

        for (const expression of expressions) {
          const nextFunction = createGraphFunction(expression, next.length);
          next.push(nextFunction);
        }

        return next;
      });
      setGraphViewport((prev) => ({ ...prev }));
      setGraphError(null);
      return {
        ok: true as const,
        message:
          expressions.length === 1
            ? `Graphing ${expressions[0]}.`
            : `Graphing ${expressions.length} functions together.`,
      };
    } catch (error) {
      setGraphError(error instanceof Error ? error.message : "I couldn't graph that expression.");
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : "I couldn't graph that expression.",
      };
    }
  }, []);

  const handleAddGraphExpression = useCallback(
    (expression: string) => {
      addGraphExpressions([expression]);
    },
    [addGraphExpressions]
  );

  const handleGraphCurrent = useCallback(() => {
    const expression = extractPrimaryGraphExpression(activeDocument);
    if (!expression) {
      setGraphError("I couldn't find a simple y = f(x) expression in the current document.");
      return;
    }

    addGraphExpressions([expression]);
  }, [activeDocument, addGraphExpressions]);

  const handleRemoveGraphFunction = useCallback((id: string) => {
    setGraphFunctions((prev) => prev.filter((graphFn) => graphFn.id !== id));
    setGraphError(null);
  }, []);

  const handleClearGraph = useCallback(() => {
    setGraphFunctions([]);
    setGraphViewport(DEFAULT_GRAPH_VIEWPORT);
    setGraphError(null);
  }, []);

  const handleViewportChange = useCallback((nextViewport: GraphViewport) => {
    setGraphViewport(nextViewport);
  }, []);

  const handleResetGraphView = useCallback(() => {
    setGraphViewport(DEFAULT_GRAPH_VIEWPORT);
    setGraphError(null);
  }, []);

  const handleSend = useCallback(
    async (message: string, imagesBase64?: string[]) => {
      if (!message.trim() || isLoading) return;

      setMessages((prev) => [...prev, { role: "user", content: message }]);

      const graphRequests = getGraphCommandExpressions(message, activeDocument);
      if (/^graph\b/i.test(message.trim())) {
        if (!graphRequests || graphRequests.length === 0) {
          const reply = "I couldn't find a graphable function. Try `graph y = x^2` or use Graph Current.";
          setGraphError("I couldn't find a simple y = f(x) expression in the current document.");
          setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
          return;
        }

        const result = addGraphExpressions(graphRequests);
        setMessages((prev) => [...prev, { role: "assistant", content: result.message }]);
        return;
      }

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

        setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);

        if (res.action !== "no_change" && res.new_document !== document) {
          setPendingDocument(res.new_document);
        }

        clearAllContext();
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "Error: Could not reach the server." }]);
      } finally {
        setIsLoading(false);
      }
    },
    [activeDocument, addGraphExpressions, clearAllContext, document, getContextString, isLoading, mode, sessionId]
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
        setMessages((prev) => [...prev, { role: "assistant", content: "Error: Could not process voice." }]);
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
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/95 backdrop-blur-sm shrink-0">
        <h1 className="text-lg font-semibold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          Voice2LaTeX
        </h1>

        <div className="absolute left-1/2 -translate-x-1/2 flex bg-zinc-800/80 rounded-xl p-1 border border-zinc-700/40">
          <button
            onClick={() => setMode("edit")}
            className={`px-5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
              mode === "edit"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Edit
          </button>
          <button
            onClick={() => setMode("tutor")}
            className={`px-5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
              mode === "tutor"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Tutor
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-800 rounded-md border border-zinc-700/50">
            <select
              value={sessionId || ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__new__") handleNewSession();
                else if (val) handleLoadSession(val);
              }}
              className="bg-transparent text-zinc-400 text-xs px-2 py-1.5 outline-none cursor-pointer hover:text-zinc-200 min-w-[140px]"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatSessionId(s.id)}
                </option>
              ))}
              <option value="__new__">+ New session</option>
            </select>
            {sessionId && (
              <button
                onClick={(e) => handleDeleteSession(e, sessionId)}
                className="p-1.5 text-zinc-500 hover:text-red-400 border-l border-zinc-700/50 transition-colors"
                title="Delete session"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path
                    fillRule="evenodd"
                    d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={handleClearSession}
            className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700/50 text-zinc-400"
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
          <button
            onClick={handleCompile}
            disabled={isCompiling || !document.trim()}
            className="px-3 py-1.5 text-xs rounded-md bg-indigo-700 hover:bg-indigo-600 disabled:opacity-30 transition-colors border border-indigo-600/50 text-zinc-200"
          >
            {isCompiling ? "Compiling..." : "Compile & Download"}
          </button>
        </div>
      </header>
      {compileError && (
        <div className="px-4 py-2 text-xs text-red-400 font-mono bg-red-950/30 border-b border-red-900/30 shrink-0">
          {compileError}
        </div>
      )}

      <div ref={containerRef} className="flex flex-1 overflow-hidden relative" style={{ zIndex: 1 }}>
        <div className="flex flex-col bg-zinc-900/30 overflow-hidden" style={{ width: `${panelWidths[0]}%` }}>
          <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800/80 font-medium uppercase tracking-wider bg-zinc-900/50 flex items-center justify-between shrink-0">
            <span>PDF Viewer</span>
            {pdfFile && <span className="text-[10px] text-zinc-600 truncate max-w-[100px]">{pdfFile.name}</span>}
          </div>
          <PdfPanel
            file={pdfFile}
            onFileUpload={handlePdfUpload}
            onTextSelected={(text) => addContextSnippet("pdf", text)}
            className="flex-1 min-h-0 overflow-hidden"
          />
        </div>

        <div
          className="w-1 bg-zinc-800/80 hover:bg-indigo-500/50 cursor-col-resize shrink-0 transition-colors"
          onMouseDown={() => handleDividerMouseDown(0)}
        />

        <div className="flex flex-col overflow-hidden relative" style={{ width: `${panelWidths[1]}%` }}>
          <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800/80 font-medium uppercase tracking-wider bg-zinc-900/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span>{pendingDocument ? "Review Changes" : "Editor"}</span>
              {pendingDocument && (
                <span className="text-[10px] text-amber-400 font-medium normal-case tracking-normal">Pending</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setEditorFontSize((s) => Math.max(10, s - 2))} className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">-</button>
              <span className="text-[9px] text-zinc-600 w-5 text-center">{editorFontSize}</span>
              <button onClick={() => setEditorFontSize((s) => Math.min(28, s + 2))} className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">+</button>
            </div>
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
            fontSize={editorFontSize}
            className="flex-1"
          />
        </div>

        <div
          className="w-1 bg-zinc-800/80 hover:bg-indigo-500/50 cursor-col-resize shrink-0 transition-colors"
          onMouseDown={() => handleDividerMouseDown(1)}
        />

        <div ref={previewPanelRef} className="flex flex-col overflow-hidden relative" style={{ width: `${panelWidths[2]}%` }}>
          <div className="px-3 py-2 text-xs border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPreviewTab("katex")}
                className={`px-2 py-0.5 rounded font-medium uppercase tracking-wider transition-colors ${
                  previewTab === "katex" ? "text-zinc-200 bg-zinc-700/60" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setPreviewTab("pdf")}
                className={`px-2 py-0.5 rounded font-medium uppercase tracking-wider transition-colors ${
                  previewTab === "pdf" ? "text-zinc-200 bg-zinc-700/60" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                PDF
              </button>
            </div>
            <div className="flex items-center gap-2">
              {previewTab === "katex" && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPreviewFontSize((s) => Math.max(10, s - 2))} className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">-</button>
                  <span className="text-[9px] text-zinc-600 w-5 text-center">{previewFontSize}</span>
                  <button onClick={() => setPreviewFontSize((s) => Math.min(32, s + 2))} className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">+</button>
                </div>
              )}
              <button
                onClick={handleGraphCurrent}
                className="rounded-md border border-zinc-700/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/80"
              >
                Graph Current
              </button>
            </div>
          </div>
          {previewTab === "katex" ? (
            <>
              <LatexPreview
                latex={activeDocument}
                fontSize={previewFontSize}
                className="flex-1 min-h-0 bg-zinc-900/40 overflow-auto latex-preview"
              />
              <SelectionPopup containerRef={previewPanelRef} source="preview" onSendToAI={addContextSnippet} />
            </>
          ) : compiledPdfFile ? (
            <PdfPanel
              file={compiledPdfFile}
              onFileUpload={() => {}}
              className="flex-1 min-h-0 overflow-hidden"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 text-xs gap-2">
              <span>No PDF compiled yet</span>
              <span className="text-zinc-700">Click &quot;Compile &amp; Download&quot; to generate</span>
            </div>
          )}
          <GraphCard
            graph={graph}
            functions={graphFunctions}
            viewport={graphViewport}
            error={graphError}
            onGraphCurrent={handleGraphCurrent}
            onAddExpression={handleAddGraphExpression}
            onRemoveFunction={handleRemoveGraphFunction}
            onClearAll={handleClearGraph}
            onViewportChange={handleViewportChange}
            onResetView={handleResetGraphView}
          />
        </div>
      </div>

      <ContextTray snippets={contextSnippets} onRemove={removeContextSnippet} onClearAll={clearAllContext} />

      <SiriBubble
        messages={messages}
        isLoading={isLoading}
        isRecording={isRecording}
        onMicToggle={handleMicToggle}
        onSend={handleSend}
        pdfContext={contextSnippets.length > 0 ? `${contextSnippets.length} context(s) attached` : null}
        onClearContext={clearAllContext}
      />
    </div>
  );
}
