"use client";

import { useState, useCallback, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
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
  }, []);

  const containerWidth = containerRef.current?.clientWidth || 350;
  const pageWidth = (containerWidth - 16) * zoom;

  return (
    <div ref={containerRef} className={`relative flex flex-col overflow-hidden ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-zinc-800/50 bg-zinc-900/30 shrink-0">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))} className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-sm">-</button>
          <span className="text-[10px] text-zinc-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.15))} className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-sm">+</button>
          <button onClick={() => setZoom(1)} className="text-[9px] text-zinc-500 hover:text-zinc-300 px-1">Reset</button>
        </div>
        {onReplaceFile && (
          <button onClick={onReplaceFile} className="text-[9px] text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 rounded hover:bg-zinc-800">
            Replace
          </button>
        )}
      </div>

      {/* Pages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-2"
        onMouseUp={handleMouseUp}
        onMouseDown={() => { setSelectedText(null); setSelectionPos(null); }}
      >
        <Document
          file={file}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={<div className="flex items-center justify-center h-32 text-sm text-zinc-500">Loading PDF...</div>}
          error={<div className="flex items-center justify-center h-32 text-sm text-red-400">Failed to load PDF</div>}
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page
              key={`${i}-${zoom}`}
              pageNumber={i + 1}
              width={pageWidth}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              className="mb-2 mx-auto"
            />
          ))}
        </Document>
      </div>

      {/* Send to AI */}
      {selectedText && selectionPos && onTextSelected && (
        <button
          data-send-ai
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onTextSelected(selectedText);
            setSelectedText(null);
            setSelectionPos(null);
            window.getSelection()?.removeAllRanges();
          }}
          className="absolute flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium px-3 py-1.5 rounded-lg shadow-xl shadow-indigo-900/30 transition-all hover:scale-105 border border-indigo-400/20"
          style={{ left: selectionPos.x, top: selectionPos.y, zIndex: 50 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M2.87 2.298a.75.75 0 0 0-.812 1.021L3.39 6.624a1 1 0 0 1 0 .752L2.058 10.68a.75.75 0 0 0 .812 1.022l11.07-3.96a.75.75 0 0 0 0-1.485L2.87 2.298Z" />
          </svg>
          Send to AI
        </button>
      )}
    </div>
  );
}
