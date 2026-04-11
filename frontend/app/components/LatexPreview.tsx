"use client";

import { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface LatexPreviewProps {
  latex: string;
  className?: string;
}

export default function LatexPreview({ latex, className = "" }: LatexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const html = katex.renderToString(latex, {
        displayMode: true,
        throwOnError: true,
        trust: true,
      });
      containerRef.current.innerHTML = html;
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "LaTeX parse error");
    }
  }, [latex]);

  return (
    <div className={className}>
      <div ref={containerRef} className="p-4 overflow-auto" />
      {error && (
        <div className="px-4 pb-2 text-sm text-red-400 font-mono">
          {error}
        </div>
      )}
    </div>
  );
}
