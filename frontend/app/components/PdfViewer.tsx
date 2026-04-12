"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  file: File;
  onTextSelected?: (text: string) => void;
  onReplaceFile?: () => void;
  className?: string;
}

export default function PdfViewer({
  file,
  onTextSelected,
  onReplaceFile,
  className = "",
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [zoom, setZoom] = useState(1.0);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollX: 0, scrollY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);
      return;
    }
    if (dragMode) return; // Don't select text in drag mode

    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 2) {
      setSelectedText(text);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setSelectionPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top - 45,
        });
      }
    } else {
      setSelectedText(null);
      setSelectionPos(null);
    }
  }, [isDragging, dragMode]);

  // Hand-drag panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!dragMode || !scrollRef.current) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollX: scrollRef.current.scrollLeft,
      scrollY: scrollRef.current.scrollTop,
    };
  }, [dragMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    scrollRef.current.scrollLeft = dragStartRef.current.scrollX - dx;
    scrollRef.current.scrollTop = dragStartRef.current.scrollY - dy;
  }, [isDragging]);

  // Clear selection on click elsewhere
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-send-ai]")) {
        setTimeout(() => {
          setSelectedText(null);
          setSelectionPos(null);
        }, 200);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  const containerWidth = containerRef.current?.clientWidth || 350;
  const pageWidth = (containerWidth - 16) * zoom;

  return (
    <div ref={containerRef} className={`relative flex flex-col ${className}`}>
      {/* Controls bar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-zinc-800/50 bg-zinc-900/30 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
            className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-sm"
          >
            -
          </button>
          <span className="text-[10px] text-zinc-500 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
            className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-sm"
          >
            +
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Hand drag toggle */}
          <button
            onClick={() => setDragMode(!dragMode)}
            className={`w-6 h-6 flex items-center justify-center rounded text-xs transition-colors ${
              dragMode ? "bg-indigo-600/30 text-indigo-400" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
            title={dragMode ? "Drag mode (click to switch to select)" : "Select mode (click to switch to drag)"}
          >
            {dragMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8 4.754a3.75 3.75 0 0 0-3.495 5.152L2.31 12.1a2.5 2.5 0 0 0 0 3.535l2.055 2.055a2.5 2.5 0 0 0 3.535 0l2.194-2.194A3.75 3.75 0 0 0 15.246 12V9.75a.75.75 0 0 0-1.5 0V12a2.25 2.25 0 1 1-4.5 0V4.754Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M10 2a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5A.75.75 0 0 1 10 2ZM5.404 4.343a.75.75 0 0 1 0 1.06 6.5 6.5 0 1 0 9.192 0 .75.75 0 1 1 1.06-1.06 8 8 0 1 1-11.313 0 .75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          {/* Replace file */}
          {onReplaceFile && (
            <button
              onClick={onReplaceFile}
              className="text-[9px] text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 rounded hover:bg-zinc-800"
            >
              Replace
            </button>
          )}
        </div>
      </div>

      {/* PDF pages */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-auto p-2 ${dragMode ? "cursor-grab" : ""} ${isDragging ? "cursor-grabbing" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsDragging(false)}
        style={dragMode ? { userSelect: "none" } : undefined}
      >
        <Document
          file={file}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={
            <div className="flex items-center justify-center h-32 text-sm text-zinc-500">
              Loading PDF...
            </div>
          }
          error={
            <div className="flex items-center justify-center h-32 text-sm text-red-400">
              Failed to load PDF
            </div>
          }
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page
              key={`${i}-${zoom}`}
              pageNumber={i + 1}
              width={pageWidth}
              renderTextLayer={!dragMode}
              renderAnnotationLayer={false}
              className="mb-2 mx-auto"
            />
          ))}
        </Document>

        {/* Floating "Send to AI" button */}
        {selectedText && selectionPos && onTextSelected && (
          <button
            data-send-ai
            onClick={() => {
              onTextSelected(selectedText);
              setSelectedText(null);
              setSelectionPos(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="absolute flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium px-3 py-1.5 rounded-lg shadow-xl shadow-indigo-900/30 transition-all hover:scale-105 border border-indigo-400/20"
            style={{
              left: Math.min(selectionPos.x, containerWidth - 120),
              top: Math.max(selectionPos.y, 40),
              zIndex: 20,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M8 1a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5A.75.75 0 0 1 8 1ZM4.11 3.05a.75.75 0 0 1 0 1.06 5.5 5.5 0 1 0 7.78 0 .75.75 0 0 1 1.06-1.06 7 7 0 1 1-9.9 0 .75.75 0 0 1 1.06 0Z" />
            </svg>
            Send to AI
          </button>
        )}
      </div>
    </div>
  );
}
