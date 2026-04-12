"use client";

import { GraphRenderData } from "../lib/graphing";

interface GraphCardProps {
  graph: GraphRenderData | null;
  error: string | null;
  onGraphCurrent: () => void;
  onGraphExpression: (expression: string) => void;
  onClear: () => void;
}

const SAMPLE_EXPRESSIONS = ["y = x^2", "y = sin(x)", "y = x^3 - 2x"];

export default function GraphCard({
  graph,
  error,
  onGraphCurrent,
  onGraphExpression,
  onClear,
}: GraphCardProps) {
  return (
    <div className="h-[42%] min-h-[240px] border-t border-zinc-800/80 bg-zinc-900/60">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/70">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Graph</p>
          <p className="text-[11px] text-zinc-400 normal-case tracking-normal">
            {graph ? graph.displayExpression : "No graph selected"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {graph && (
            <button
              onClick={onClear}
              className="px-2.5 py-1 text-[11px] rounded-md border border-zinc-700/70 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            >
              Clear
            </button>
          )}
          <button
            onClick={onGraphCurrent}
            className="px-2.5 py-1 text-[11px] rounded-md bg-indigo-600/90 text-white hover:bg-indigo-500"
          >
            Graph Current
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-zinc-800/80">
        {SAMPLE_EXPRESSIONS.map((expression) => (
          <button
            key={expression}
            onClick={() => onGraphExpression(expression)}
            className="rounded-full border border-zinc-700/70 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/80"
          >
            {expression}
          </button>
        ))}
      </div>

      <div className="h-[calc(100%-82px)] p-3">
        {error ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-red-900/60 bg-red-950/20 px-4 text-center text-sm text-red-300">
            {error}
          </div>
        ) : graph ? (
          <div className="h-full rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-3">
            <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
              <rect x="0" y="0" width="100" height="100" rx="4" fill="transparent" />
              <g stroke="rgba(63,63,70,0.6)" strokeWidth="0.35">
                {graph.xTicks.map((tick) => (
                  <line
                    key={`x-grid-${tick}`}
                    x1={((tick + 4) / 8) * 100}
                    y1="0"
                    x2={((tick + 4) / 8) * 100}
                    y2="100"
                  />
                ))}
                {graph.yTicks.map((tick, index) => (
                  <line
                    key={`y-grid-${tick}`}
                    x1="0"
                    y1={graph.yTickPositions[index]}
                    x2="100"
                    y2={graph.yTickPositions[index]}
                  />
                ))}
              </g>
              <line x1="0" y1={graph.xAxisY} x2="100" y2={graph.xAxisY} stroke="rgba(161,161,170,0.95)" strokeWidth="0.55" />
              <line x1={graph.yAxisX} y1="0" x2={graph.yAxisX} y2="100" stroke="rgba(161,161,170,0.95)" strokeWidth="0.55" />
              {graph.pathData.map((path) => (
                <path
                  key={path}
                  d={path}
                  fill="none"
                  stroke="rgb(96,165,250)"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/50 px-5 text-center">
            <p className="text-sm font-medium text-zinc-300">No graph selected</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
              Graph a simple function from your document or try one of the sample expressions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
