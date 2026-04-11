"use client";

import { useState, useCallback } from "react";
import ChatPanel, { ChatMessage } from "./components/ChatPanel";
import LatexPreview from "./components/LatexPreview";
import { sendChatMessage } from "./lib/api";

const SAMPLE_LATEX = "\\int_0^1 x^2 \\, dx = \\frac{1}{3}";

export default function Home() {
  const [mode, setMode] = useState<"chat" | "voice">("chat");
  const [document, setDocument] = useState(SAMPLE_LATEX);
  const [documentHistory, setDocumentHistory] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
          { role: "assistant", content: res.reply },
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

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
        <h1 className="text-lg font-semibold tracking-tight">Voice2LaTeX</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={documentHistory.length === 0}
            className="px-3 py-1 text-sm rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 transition-colors"
          >
            Undo
          </button>
          <div className="flex bg-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setMode("chat")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                mode === "chat"
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setMode("voice")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                mode === "voice"
                  ? "bg-blue-600 text-white"
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
          <div className="w-[30%] border-r border-zinc-800 flex flex-col">
            <ChatPanel
              messages={messages}
              onSend={handleSend}
              isLoading={isLoading}
            />
          </div>

          {/* Raw editor */}
          <div className="w-[35%] border-r border-zinc-800 flex flex-col">
            <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800 font-medium uppercase tracking-wider">
              Editor
            </div>
            <textarea
              value={document}
              onChange={(e) => {
                pushHistory(document);
                setDocument(e.target.value);
              }}
              className="flex-1 bg-zinc-950 text-zinc-200 font-mono text-sm p-3 resize-none outline-none"
              spellCheck={false}
            />
          </div>

          {/* KaTeX preview */}
          <div className="w-[35%] flex flex-col">
            <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800 font-medium uppercase tracking-wider">
              Preview
            </div>
            <LatexPreview
              latex={document}
              className="flex-1 bg-zinc-900 overflow-auto"
            />
          </div>
        </div>
      ) : (
        /* Voice mode */
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <LatexPreview
            latex={document}
            className="w-full max-w-3xl mx-auto bg-zinc-900 rounded-xl shadow-lg p-8 min-h-[200px]"
          />
          <div className="mt-12">
            <button className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 transition-colors flex items-center justify-center shadow-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-7 h-7 text-white"
              >
                <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
                <path d="M6 10a1 1 0 0 0-2 0 8 8 0 0 0 7 7.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.07A8 8 0 0 0 20 10a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z" />
              </svg>
            </button>
          </div>
          <p className="mt-4 text-zinc-500 text-sm">
            Press the mic button to start speaking
          </p>
        </div>
      )}
    </div>
  );
}
