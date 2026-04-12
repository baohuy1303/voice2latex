"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import katex from "katex";
import { marked } from "marked";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SiriBubbleProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isRecording: boolean;
  onMicToggle: () => void;
  onSend: (message: string, imagesBase64?: string[]) => void;
  pdfContext: string | null;
  onClearContext: () => void;
  voicePhase?: "idle" | "transcribing" | "thinking";
}

// Configure marked for inline use (no wrapping <p> for single lines)
marked.setOptions({ breaks: true });

function renderContent(text: string): string {
  // 1. Protect $$ and $ blocks from markdown processing
  const mathBlocks: string[] = [];
  let processed = text.replace(/\$\$([^$]+)\$\$/g, (_m, expr) => {
    const idx = mathBlocks.length;
    try { mathBlocks.push(katex.renderToString(expr, { displayMode: true, throwOnError: false })); }
    catch { mathBlocks.push(`$$${expr}$$`); }
    return `%%MATH${idx}%%`;
  });
  processed = processed.replace(/\$([^$]+)\$/g, (_m, expr) => {
    const idx = mathBlocks.length;
    try { mathBlocks.push(katex.renderToString(expr, { displayMode: false, throwOnError: false })); }
    catch { mathBlocks.push(`$${expr}$`); }
    return `%%MATH${idx}%%`;
  });

  // 2. Render markdown (bold, italic, lists, etc.)
  let html = marked.parse(processed) as string;

  // 3. Restore math blocks
  mathBlocks.forEach((block, idx) => {
    html = html.replace(`%%MATH${idx}%%`, block);
  });

  return html;
}

export default function SiriBubble({
  messages,
  isLoading,
  isRecording,
  onMicToggle,
  onSend,
  pdfContext,
  onClearContext,
  voicePhase = "idle",
}: SiriBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImages, setUploadedImages] = useState<Array<{name: string, base64: string}>>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isExpanded) inputRef.current?.focus();
  }, [isExpanded]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result;
        if (typeof result === "string") {
          // Keep only the base64 part, split off "data:image/jpeg;base64,"
          const base64 = result.split(",")[1];
          if (base64) {
            setUploadedImages(prev => [...prev, { name: file.name, base64 }]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed && uploadedImages.length === 0) return;
      if (isLoading) return;
      
      const b64 = uploadedImages.map(img => img.base64);
      onSend(trimmed || "See attached image.", b64);
      setInput("");
      setUploadedImages([]);
    },
    [input, isLoading, onSend, uploadedImages]
  );

  const siriState = isRecording
    ? "siri-recording"
    : voicePhase === "transcribing"
    ? "siri-transcribing"
    : isLoading
    ? "siri-thinking"
    : "siri-idle";

  if (isCollapsed) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setIsCollapsed(false)}
        className="fixed bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-zinc-800/60 backdrop-blur-sm border border-zinc-700/30 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/60 transition-all"
        style={{ zIndex: 9999 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 0 1-1.06-.02L10 8.832 6.29 12.77a.75.75 0 1 1-1.08-1.04l4.25-4.5a.75.75 0 0 1 1.08 0l4.25 4.5a.75.75 0 0 1-.02 1.06Z" clipRule="evenodd" />
        </svg>
      </motion.button>
    );
  }

  return (
    <>
      {/* Floating conversation bubbles */}
      <AnimatePresence>
        {!isExpanded && (messages.length > 0 || isLoading) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed left-1/2 -translate-x-1/2 w-[340px] flex flex-col gap-1.5 pointer-events-none"
            style={{ zIndex: 9998, bottom: "100px" }}
          >
            {messages.slice(-2).map((msg, i) => (
              <motion.div
                key={messages.length - 2 + i}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.1, type: "spring", damping: 20, stiffness: 300 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs leading-relaxed max-h-[60px] overflow-hidden break-words min-w-0 ${
                    msg.role === "user"
                      ? "bg-blue-600/20 text-blue-200 rounded-br-sm backdrop-blur-sm"
                      : "bg-zinc-800/20 text-zinc-300 rounded-bl-sm backdrop-blur-sm chat-markdown"
                  }`}
                  dangerouslySetInnerHTML={
                    msg.role === "assistant"
                      ? { __html: renderContent(msg.content.length > 150 ? msg.content.slice(0, 150) + "..." : msg.content) }
                      : undefined
                  }
                >
                  {msg.role === "user" ? (msg.content.length > 100 ? msg.content.slice(0, 100) + "..." : msg.content) : undefined}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex justify-start"
              >
                <div className="bg-zinc-800/20 backdrop-blur-sm rounded-2xl rounded-bl-sm px-3 py-1.5 text-xs text-zinc-400 flex gap-1">
                  <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main bubble container */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center"
        style={{ zIndex: 9999 }}
      >
        {/* Expanded chat panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, scale: 0.9 }}
              animate={{ height: "auto", opacity: 1, scale: 1 }}
              exit={{ height: 0, opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="mb-4 w-[580px] bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/80">
                <span className="text-xs font-medium text-zinc-400">Chat</span>
                <button onClick={() => setIsExpanded(false)} className="text-zinc-500 hover:text-zinc-300 text-sm leading-none">
                  &times;
                </button>
              </div>

              <div className="overflow-y-auto p-3 space-y-2.5 max-h-[500px]">
                {messages.length === 0 && (
                  <p className="text-zinc-600 text-xs text-center mt-6">Speak or type to edit your LaTeX...</p>
                )}
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.03 * i }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed break-words min-w-0 ${
                        msg.role === "user"
                          ? "bg-blue-600/90 text-white rounded-br-sm"
                          : "bg-zinc-800 text-zinc-200 rounded-bl-sm chat-markdown"
                      }`}
                      dangerouslySetInnerHTML={
                        msg.role === "assistant" ? { __html: renderContent(msg.content) } : undefined
                      }
                    >
                      {msg.role === "user" ? msg.content : undefined}
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-3 py-2 text-xs text-zinc-400 flex gap-1">
                      <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {pdfContext && (
                <div className="mx-3 mb-1 flex items-center gap-1.5 px-2 py-1 bg-blue-950/50 border border-blue-800/30 rounded-lg">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-[10px] text-zinc-400 truncate flex-1">{pdfContext}</span>
                  <button onClick={onClearContext} className="text-zinc-500 hover:text-zinc-300 text-[10px]">&times;</button>
                </div>
              )}

              {uploadedImages.length > 0 && (
                <div className="mx-3 mb-1 flex flex-wrap gap-1.5">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 border border-zinc-700/50 rounded-md">
                      <span className="text-[10px] text-zinc-400">🖼️ {img.name}</span>
                      <button onClick={() => setUploadedImages(prev => prev.filter((_, i) => i !== idx))} className="text-zinc-500 hover:text-red-400 text-[10px]">&times;</button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSubmit} className="p-2.5 border-t border-zinc-800/80">
                <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                    </svg>
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a command..."
                    disabled={isLoading}
                    className="flex-1 bg-zinc-800/80 text-zinc-100 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder-zinc-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || (!input.trim() && uploadedImages.length === 0)}
                    className="px-3 py-2 text-xs font-medium rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white transition-colors"
                  >
                    Send
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls row */}
        <div className="flex items-center gap-3">
          {/* Chat toggle */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsExpanded(!isExpanded)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors border ${
              isExpanded
                ? "bg-zinc-700 border-zinc-600 text-white"
                : "bg-zinc-900/90 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5">
              <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 20.97V18.9a49.8 49.8 0 0 1-1.087-.058C2.99 18.63 1.5 16.963 1.5 14.97V6.385c0-1.866 1.369-3.477 3.413-3.727ZM15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
            </svg>
          </motion.button>

          {/* Siri voice orb */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onMicToggle}
            disabled={isLoading}
            className={`w-16 h-16 rounded-full flex items-center justify-center disabled:opacity-40 ${siriState}`}
          >
            {isRecording ? (
              <motion.svg
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white/90 drop-shadow-lg"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </motion.svg>
            ) : voicePhase === "transcribing" ? (
              <div className="flex gap-0.5 items-end h-4">
                {[0,1,2,3,4].map(i => (
                  <motion.span key={i} className="w-1 bg-white/80 rounded-full"
                    animate={{ height: ["4px","14px","4px"] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i*0.1 }} />
                ))}
              </div>
            ) : isLoading ? (
              <div className="flex gap-1">
                <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-white/80 rounded-full" />
                <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} className="w-1.5 h-1.5 bg-white/80 rounded-full" />
                <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} className="w-1.5 h-1.5 bg-white/80 rounded-full" />
              </div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white/90 drop-shadow-lg">
                <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
                <path d="M6 10a1 1 0 0 0-2 0 8 8 0 0 0 7 7.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.07A8 8 0 0 0 20 10a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z" />
              </svg>
            )}
          </motion.button>

          {/* Collapse */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCollapsed(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-900/90 border border-zinc-700/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
            </svg>
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}
