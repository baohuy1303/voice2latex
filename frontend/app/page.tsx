"use client";

import { useState, useCallback } from "react";
import ChatPanel, { ChatMessage } from "./components/ChatPanel";
import LatexPreview from "./components/LatexPreview";
import { sendChatMessage, transcribeAudio } from "./lib/api";
import useMicrophone from "./hooks/useMicrophone";

const PRESETS: { name: string; latex: string }[] = [
  {
    name: "Calculus",
    latex: `$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$

$$\\frac{d}{dx} \\sin(x) = \\cos(x)$$`,
  },
  {
    name: "Linear Algebra",
    latex: `$$A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$$

$$\\det(A) = (1)(4) - (2)(3) = -2$$`,
  },
  {
    name: "Empty",
    latex: "",
  },
];

export default function Home() {
  const [mode, setMode] = useState<"chat" | "voice">("chat");
  const [document, setDocument] = useState(PRESETS[0].latex);
  const [documentHistory, setDocumentHistory] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const { isRecording, startRecording, stopRecording, error: micError } = useMicrophone();

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
      setMessages((prev) => [...prev, { role: "user", content: message }]);
      setIsLoading(true);

      try {
        const res = await sendChatMessage(message, document);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.reply, explanation: res.explanation || undefined },
        ]);

        if (res.action !== "no_change" && res.new_document !== document) {
          pushHistory(document);
          setDocument(res.new_document);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error: Could not reach the server." },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [document, pushHistory]
  );

  const handleMicToggle = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob) return;

      setIsLoading(true);
      setLastTranscript(null);

      try {
        const transcript = await transcribeAudio(blob);
        if (!transcript) {
          setLastTranscript("(no speech detected)");
          setIsLoading(false);
          return;
        }

        setLastTranscript(transcript);
        setMessages((prev) => [...prev, { role: "user", content: transcript }]);

        const res = await sendChatMessage(transcript, document);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.reply, explanation: res.explanation || undefined },
        ]);

        if (res.action !== "no_change" && res.new_document !== document) {
          pushHistory(document);
          setDocument(res.new_document);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error: Could not process voice command." },
        ]);
      } finally {
        setIsLoading(false);
      }
    } else {
      await startRecording();
      setLastTranscript(null);
    }
  }, [isRecording, stopRecording, startRecording, document, pushHistory]);

  const loadPreset = useCallback(
    (latex: string) => {
      pushHistory(document);
      setDocument(latex);
    },
    [document, pushHistory]
  );

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            Voice2LaTeX
          </h1>
          {/* Preset selector */}
          <select
            onChange={(e) => {
              const preset = PRESETS.find((p) => p.name === e.target.value);
              if (preset) loadPreset(preset.latex);
            }}
            className="bg-zinc-800 text-zinc-400 text-xs rounded-md px-2 py-1 outline-none border border-zinc-700 cursor-pointer hover:border-zinc-600"
            defaultValue=""
          >
            <option value="" disabled>
              Load preset...
            </option>
            {PRESETS.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={documentHistory.length === 0}
            className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 transition-colors border border-zinc-700/50"
          >
            Undo
          </button>
          <div className="flex bg-zinc-800 rounded-lg p-0.5 border border-zinc-700/50">
            <button
              onClick={() => setMode("chat")}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors font-medium ${
                mode === "chat"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setMode("voice")}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors font-medium ${
                mode === "voice"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Voice
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      {mode === "chat" ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Chat panel */}
          <div className="w-[30%] min-w-[280px] border-r border-zinc-800/80 flex flex-col bg-zinc-950">
            <ChatPanel
              messages={messages}
              onSend={handleSend}
              isLoading={isLoading}
            />
          </div>

          {/* Raw editor */}
          <div className="w-[35%] border-r border-zinc-800/80 flex flex-col">
            <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800/80 font-medium uppercase tracking-wider bg-zinc-900/50">
              Editor
            </div>
            <textarea
              value={document}
              onChange={(e) => {
                pushHistory(document);
                setDocument(e.target.value);
              }}
              className="flex-1 bg-zinc-950 text-zinc-300 font-mono text-sm p-4 resize-none outline-none leading-relaxed"
              spellCheck={false}
              placeholder="Type or paste LaTeX here..."
            />
          </div>

          {/* KaTeX preview */}
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
      ) : (
        /* Voice mode */
        <div className="flex-1 flex flex-col items-center relative px-4 overflow-y-auto py-10">
          {/* Document preview */}
          <div className="w-full max-w-3xl mx-auto">
            <LatexPreview
              latex={document}
              className="bg-zinc-900/60 rounded-2xl shadow-2xl shadow-black/20 p-10 min-h-[200px] border border-zinc-800/50 latex-preview"
            />
          </div>

          {/* Transcript flash */}
          {lastTranscript && (
            <div className="mt-6 px-5 py-2.5 bg-zinc-800/80 rounded-xl text-sm text-zinc-300 max-w-xl text-center border border-zinc-700/50">
              &ldquo;{lastTranscript}&rdquo;
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="mt-5 flex items-center gap-2 text-sm text-zinc-400">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              Processing...
            </div>
          )}

          {/* Mic error */}
          {micError && (
            <div className="mt-4 px-4 py-2 bg-red-950/50 border border-red-800/50 rounded-lg text-sm text-red-400">
              {micError}
            </div>
          )}

          {/* Mic button */}
          <div className="mt-10">
            <button
              onClick={handleMicToggle}
              disabled={isLoading}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 disabled:opacity-40 ${
                isRecording
                  ? "bg-red-500 scale-110 mic-recording"
                  : "bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 hover:scale-105"
              }`}
            >
              {isRecording ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white">
                  <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
                  <path d="M6 10a1 1 0 0 0-2 0 8 8 0 0 0 7 7.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.07A8 8 0 0 0 20 10a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z" />
                </svg>
              )}
            </button>
          </div>

          {/* Controls row */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleUndo}
              disabled={documentHistory.length === 0}
              className="px-4 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 transition-colors border border-zinc-700/50"
            >
              Undo
            </button>
          </div>

          <p className="mt-3 text-zinc-500 text-xs">
            {isRecording ? "Listening... tap to stop" : "Tap the mic to start speaking"}
          </p>

          {/* Recent command history */}
          {messages.length > 0 && (
            <div className="absolute bottom-4 left-4 max-w-xs bg-zinc-900/80 backdrop-blur-sm rounded-lg p-3 border border-zinc-800/50">
              <div className="text-[10px] text-zinc-600 mb-1.5 uppercase tracking-wider font-medium">Recent</div>
              {messages.slice(-4).map((msg, i) => (
                <div key={i} className={`text-xs truncate leading-relaxed ${msg.role === "user" ? "text-zinc-400" : "text-zinc-500"}`}>
                  {msg.role === "user" ? "> " : "  "}{msg.content}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
