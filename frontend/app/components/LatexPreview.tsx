"use client";

import { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface LatexPreviewProps {
  latex: string;
  className?: string;
}

function renderBlocks(input: string): string {
  const parts: string[] = [];
  // Split on $$ delimiters to find display math blocks and text between them
  const segments = input.split(/\$\$/);

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i].trim();
    if (!segment) continue;

    if (i % 2 === 1) {
      // Inside $$ ... $$ — render as display math
      parts.push(
        katex.renderToString(segment, {
          displayMode: true,
          throwOnError: false,
          trust: true,
        })
      );
    } else {
      // Outside $$ — render inline math ($...$) and plain text
      const inlineParts = segment.split(/\$([^$]+)\$/g);
      for (let j = 0; j < inlineParts.length; j++) {
        const part = inlineParts[j].trim();
        if (!part) continue;
        if (j % 2 === 1) {
          parts.push(
            katex.renderToString(part, {
              displayMode: false,
              throwOnError: false,
              trust: true,
            })
          );
        } else {
          parts.push(`<p class="my-1 text-zinc-300">${part}</p>`);
        }
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
