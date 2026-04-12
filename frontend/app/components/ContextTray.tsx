"use client";

import { useState } from "react";

export interface ContextSnippet {
  id: string;
  source: "pdf" | "editor" | "preview";
  text: string;
}

interface ContextTrayProps {
  snippets: ContextSnippet[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  pdf: { label: "PDF", color: "text-orange-400 bg-orange-950/50 border-orange-800/30" },
  editor: { label: "Editor", color: "text-blue-400 bg-blue-950/50 border-blue-800/30" },
  preview: { label: "Preview", color: "text-violet-400 bg-violet-950/50 border-violet-800/30" },
};

export default function ContextTray({ snippets, onRemove, onClearAll }: ContextTrayProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (snippets.length === 0) return null;

  return (
    <div
      className="fixed right-4 top-14 w-[260px] bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl shadow-2xl shadow-black/30 overflow-hidden"
      style={{ zIndex: 9990 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[11px] font-medium text-zinc-300">
            Context ({snippets.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-zinc-500 hover:text-zinc-300 text-xs px-1"
          >
            {isCollapsed ? "+" : "-"}
          </button>
          <button
            onClick={onClearAll}
            className="text-zinc-500 hover:text-red-400 text-[10px] px-1"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Snippets */}
      {!isCollapsed && (
        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1.5">
          {snippets.map((s) => {
            const style = SOURCE_LABELS[s.source];
            return (
              <div
                key={s.id}
                className="group flex items-start gap-2 p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800/80 transition-colors"
              >
                <span className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${style.color}`}>
                  {style.label}
                </span>
                <p className="text-[10px] text-zinc-400 leading-relaxed flex-1 line-clamp-3">
                  {s.text}
                </p>
                <button
                  onClick={() => onRemove(s.id)}
                  className="text-zinc-600 hover:text-red-400 text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
