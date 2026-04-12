"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm text-zinc-500">
      Loading viewer...
    </div>
  ),
});

interface PdfPanelProps {
  file: File | null;
  onFileUpload: (file: File) => void;
  onTextSelected?: (text: string) => void;
  className?: string;
}

export default function PdfPanel({
  file,
  onFileUpload,
  onTextSelected,
  className = "",
}: PdfPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile?.type === "application/pdf") {
        onFileUpload(droppedFile);
      }
    },
    [onFileUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) onFileUpload(selected);
    },
    [onFileUpload]
  );

  const handleReplaceFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (!file) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-full ${className}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isDragOver ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 hover:border-zinc-500"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mx-auto mb-3 text-zinc-500">
            <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm text-zinc-400 mb-2">Drop a PDF here</p>
          <label className="cursor-pointer text-xs text-blue-400 hover:text-blue-300">
            or click to browse
            <input type="file" accept=".pdf" onChange={handleFileInput} className="hidden" />
          </label>
        </div>
      </div>
    );
  }

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileInput} className="hidden" />
      <PdfViewer
        file={file}
        onTextSelected={onTextSelected}
        onReplaceFile={handleReplaceFile}
        className={className}
      />
    </>
  );
}
