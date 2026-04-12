"use client";

import { useState, useRef, useEffect } from "react";
import katex from "katex";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  explanation?: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading?: boolean;
}

function renderInlineKatex(text: string): string {
  // Replace $$...$$ with display math, then $...$ with inline math
  let html = text.replace(/\$\$([^$]+)\$\$/g, (_match, expr) => {
    try {
      return katex.renderToString(expr, { displayMode: true, throwOnError: false });
    } catch {
      return `$$${expr}$$`;
    }
  });

  html = html.replace(/\$([^$]+)\$/g, (_match, expr) => {
    try {
      return katex.renderToString(expr, { displayMode: false, throwOnError: false });
    } catch {
      return `$${expr}$`;
    }
  });

  return html;
}

export default function ChatPanel({ messages, onSend, isLoading = false }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-zinc-500 text-sm text-center mt-8">
            Send a message to edit your LaTeX document...
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            <div
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-200"
                }`}
                dangerouslySetInnerHTML={
                  msg.role === "assistant"
                    ? { __html: renderInlineKatex(msg.content) }
                    : undefined
                }
              >
                {msg.role === "user" ? msg.content : undefined}
              </div>
            </div>
            {msg.explanation && (
              <div className="mt-1 ml-1">
                <div
                  className="bg-zinc-850 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
                  dangerouslySetInnerHTML={{ __html: renderInlineKatex(msg.explanation) }}
                />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 text-zinc-400 rounded-lg px-3 py-2 text-sm animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a command..."
            disabled={isLoading}
            className="flex-1 bg-zinc-800 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
