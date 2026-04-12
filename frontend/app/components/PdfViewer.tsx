"use client";

import { useState, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  file: File;
  onTextSelected?: (text: string) => void;
  className?: string;
}

export default function PdfViewer({
  file,
  onTextSelected,
  className = "",
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    if (!onTextSelected) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 2) {
      onTextSelected(text);
    }
  }, [onTextSelected]);

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto ${className}`}
      onMouseUp={handleMouseUp}
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
            key={i}
            pageNumber={i + 1}
            width={containerRef.current?.clientWidth ? containerRef.current.clientWidth - 16 : 300}
            renderTextLayer={true}
            renderAnnotationLayer={false}
            className="mb-2"
          />
        ))}
      </Document>
    </div>
  );
}
