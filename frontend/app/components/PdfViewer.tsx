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
  const [selectMode, setSelectMode] = useState(true);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!selectMode) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 2) {
      setSelectedText(text);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setSelectionPos({
          x: Math.min(e.clientX - rect.left, rect.width - 120),
          y: Math.max(e.clientY - rect.top - 40, 5),
        });
      }
    } else {
      setSelectedText(null);
      setSelectionPos(null);
    }
  }, [selectMode]);

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
          {/* Select mode: mouse cursor */}
          <button
            onClick={() => setSelectMode(true)}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
              selectMode ? "bg-indigo-600/30 text-indigo-400" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
            title="Select text"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M6.672 1.911a1 1 0 1 0-1.932.518l.259.966a1 1 0 0 0 1.932-.518l-.26-.966ZM2.429 4.74a1 1 0 1 0-.517 1.932l.966.259a1 1 0 0 0 .517-1.932l-.966-.26Zm8.814-.569a1 1 0 0 0-1.415-1.414l-.707.707a1 1 0 1 0 1.415 1.415l.707-.708Zm-7.071 7.072.707-.707A1 1 0 0 0 3.465 9.12l-.708.707a1 1 0 0 0 1.415 1.415Zm3.2-5.171a1 1 0 0 0-1.3 1.3l4 10a1 1 0 0 0 1.823.075l1.38-2.759 3.018 3.02a1 1 0 0 0 1.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 0 0-.076-1.822l-10-4Z" clipRule="evenodd" />
            </svg>
          </button>
          {/* Scroll mode: hand */}
          <button
            onClick={() => setSelectMode(false)}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
              !selectMode ? "bg-indigo-600/30 text-indigo-400" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
            title="Scroll / pan"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M8.5 3.528v4.644c0 .729-.29 1.428-.805 1.944l-1.217 1.216a8.75 8.75 0 0 1 3.55.621l.502.201a7.25 7.25 0 0 0 4.178.365l-2.403-2.403a2.75 2.75 0 0 1-.805-1.944V3.528a.75.75 0 0 0-1.5 0v4.644a1.25 1.25 0 0 1-.366.884l-.28.28-.28-.28a1.25 1.25 0 0 1-.366-.884V3.528a.75.75 0 0 0-1.5 0v4.644c0 .317-.12.622-.337.855l-.143.15-.143-.15a1.25 1.25 0 0 1-.337-.855V3.528a.75.75 0 0 0-1.5 0Z" clipRule="evenodd" />
            </svg>
          </button>
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

      {/* PDF pages — always scrollable via native scrollbars */}
      <div
        className={`flex-1 overflow-auto p-2 ${!selectMode ? "cursor-grab" : ""}`}
        onMouseUp={selectMode ? handleMouseUp : undefined}
        style={!selectMode ? { userSelect: "none" } : undefined}
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
              renderTextLayer={selectMode}
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
              <path d="M2.87 2.298a.75.75 0 0 0-.812 1.021L3.39 6.624a1 1 0 0 1 0 .752L2.058 10.68a.75.75 0 0 0 .812 1.022l11.07-3.96a.75.75 0 0 0 0-1.485L2.87 2.298Z" />
            </svg>
            Send to AI
          </button>
        )}
      </div>
    </div>
  );
}
