"use client";

import { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface LatexPreviewProps {
  latex: string;
  className?: string;
}

function renderInlineMath(text: string): string {
  // Render $...$ inline math within a text line, keeping everything inline
  return text.replace(/\$([^$]+)\$/g, (_match, expr) => {
    try {
      return katex.renderToString(expr, {
        displayMode: false,
        throwOnError: false,
        trust: true,
      });
    } catch {
      return `$${expr}$`;
    }
  });
}

function renderBlocks(input: string): string {
  const parts: string[] = [];
  const segments = input.split(/\$\$/);

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (i % 2 === 1) {
      // Inside $$ ... $$ — render as display math
      const trimmed = segment.trim();
      if (trimmed) {
        parts.push(
          katex.renderToString(trimmed, {
            displayMode: true,
            throwOnError: false,
            trust: true,
          })
        );
      }
    } else {
      // Outside $$ — process line by line, keeping inline math on the same line as text
      const lines = segment.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Render the whole line as one <p>, with inline $...$ converted to KaTeX spans
        const rendered = renderInlineMath(trimmed);
        parts.push(`<p class="my-1.5 text-zinc-300 leading-relaxed">${rendered}</p>`);
      }
    }
  }

  return parts.join("");
}

export default function LatexPreview({ latex, className = "" }: LatexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      // Normalize: convert \[...\] to $$...$$ so everything uses one format
      let normalized = latex.replace(/\\\[/g, "$$").replace(/\\\]/g, "$$");

      if (normalized.includes("$$")) {
        containerRef.current.innerHTML = renderBlocks(normalized);
      } else {
        // Single expression without delimiters — render as one display block
        containerRef.current.innerHTML = katex.renderToString(normalized, {
          displayMode: true,
          throwOnError: false,
          trust: true,
        });
      }
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
