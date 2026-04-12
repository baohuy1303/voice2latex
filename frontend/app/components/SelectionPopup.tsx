"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface SelectionPopupProps {
  containerRef: React.RefObject<HTMLElement | null>;
  source: "pdf" | "editor" | "preview";
  onSendToAI: (source: "pdf" | "editor" | "preview", text: string) => void;
  disabled?: boolean;
}

export default function SelectionPopup({
  containerRef,
  source,
  onSendToAI,
  disabled = false,
}: SelectionPopupProps) {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (disabled) return;
    // Ignore if clicking on the button itself
    if (buttonRef.current?.contains(e.target as Node)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text && text.length > 2 && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setSelectedText(text);
        setPos({
          x: Math.min(e.clientX - rect.left, rect.width - 120),
          y: Math.max(e.clientY - rect.top - 40, 5),
        });
      } else {
        setSelectedText(null);
        setPos(null);
      }
    }, 10);
  }, [containerRef, disabled]);

  // Clear on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (buttonRef.current?.contains(e.target as Node)) return;
      // Delay to let mouseup fire first
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection?.toString().trim()) {
          setSelectedText(null);
          setPos(null);
        }
      }, 150);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("mouseup", handleMouseUp);
    return () => el.removeEventListener("mouseup", handleMouseUp);
  }, [containerRef, handleMouseUp]);

  if (!selectedText || !pos) return null;

  return (
    <button
      ref={buttonRef}
      onClick={() => {
        onSendToAI(source, selectedText);
        setSelectedText(null);
        setPos(null);
        window.getSelection()?.removeAllRanges();
      }}
      className="absolute flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium px-3 py-1.5 rounded-lg shadow-xl shadow-indigo-900/30 transition-all hover:scale-105 border border-indigo-400/20"
      style={{
        left: pos.x,
        top: pos.y,
        zIndex: 50,
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
        <path d="M2.87 2.298a.75.75 0 0 0-.812 1.021L3.39 6.624a1 1 0 0 1 0 .752L2.058 10.68a.75.75 0 0 0 .812 1.022l11.07-3.96a.75.75 0 0 0 0-1.485L2.87 2.298Z" />
      </svg>
      Send to AI
    </button>
  );
}
