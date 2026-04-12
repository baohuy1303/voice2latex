"use client";

import { useState } from "react";
import { GraphFunction, GraphRenderData, GraphViewport } from "../lib/graphing";

interface GraphCardProps {
  graph: GraphRenderData | null;
  functions: GraphFunction[];
  viewport: GraphViewport;
  error: string | null;
  onGraphCurrent: () => void;
  onAddExpression: (expression: string) => void;
  onRemoveFunction: (id: string) => void;
  onClearAll: () => void;
  onViewportChange: (viewport: GraphViewport) => void;
  onResetView: () => void;
}

interface DragState {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const SAMPLE_EXPRESSIONS = ["y = x^2", "y = x + 2", "y = sin(x)", "y = cos(x)", "y = x^3 - 2x"];
const MIN_SPAN = 0.8;
const MAX_SPAN = 80;

function zoomViewport(viewport: GraphViewport, factor: number): GraphViewport {
  const centerX = (viewport.xMin + viewport.xMax) / 2;
  const centerY = (viewport.yMin + viewport.yMax) / 2;
  const width = Math.min(Math.max((viewport.xMax - viewport.xMin) * factor, MIN_SPAN), MAX_SPAN);
  const height = Math.min(Math.max((viewport.yMax - viewport.yMin) * factor, MIN_SPAN), MAX_SPAN);

  return {
    xMin: centerX - width / 2,
    xMax: centerX + width / 2,
    yMin: centerY - height / 2,
    yMax: centerY + height / 2,
  };
}

export default function GraphCard({
  graph,
  functions,
  viewport,
  error,
  onGraphCurrent,
  onAddExpression,
  onRemoveFunction,
  onClearAll,
  onViewportChange,
  onResetView,
}: GraphCardProps) {
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  const graphHeightClass = isExpanded ? "h-[62%] min-h-[400px]" : "h-[48%] min-h-[320px]";
  const hasFunctions = functions.length > 0;

  return (
    <div className={`${graphHeightClass} border-t border-zinc-800/80 bg-zinc-900/55 transition-all duration-200`}>
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-900/70 px-3 py-2.5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Graph</p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            {hasFunctions ? `${functions.length} curve${functions.length > 1 ? "s" : ""}` : "Interactive canvas"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasFunctions && (
            <button
              onClick={onClearAll}
              className="rounded-md border border-zinc-700/70 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            >
              Clear All
            </button>
          )}
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="rounded-md border border-zinc-700/70 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/80"
          >
            {isExpanded ? "Compact" : "Expand"}
          </button>
          <button
            onClick={onGraphCurrent}
            className="rounded-md bg-indigo-600/90 px-2.5 py-1 text-[11px] text-white hover:bg-indigo-500"
          >
            Graph Current
          </button>
        </div>
      </div>

      <div className="border-b border-zinc-800/80 px-3 py-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!input.trim()) return;
            onAddExpression(input);
            setInput("");
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Add another function, e.g. y = x + 2"
            className="flex-1 rounded-md border border-zinc-700/70 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-indigo-500/60"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
          >
            Add
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800/80 px-3 py-2.5">
        {SAMPLE_EXPRESSIONS.map((expression) => (
          <button
            key={expression}
            onClick={() => onAddExpression(expression)}
            className="rounded-full border border-zinc-700/70 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/80"
          >
            {expression}
          </button>
        ))}
      </div>

      <div className="grid h-[calc(100%-126px)] grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_178px]">
        <div className="flex min-h-0 flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-3">
          <div className="mb-3 flex items-center justify-end gap-3">
            {hasFunctions && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onViewportChange(zoomViewport(viewport, 1.18))}
                  className="rounded-md border border-zinc-700/70 px-2.5 py-1 text-sm font-medium text-zinc-200 hover:bg-zinc-800/80"
                >
                  -
                </button>
                <button
                  onClick={() => onViewportChange(zoomViewport(viewport, 0.84))}
                  className="rounded-md border border-zinc-700/70 px-2.5 py-1 text-sm font-medium text-zinc-200 hover:bg-zinc-800/80"
                >
                  +
                </button>
                <button
                  onClick={onResetView}
                  className="rounded-md border border-zinc-700/70 px-2.5 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800/80"
                >
                  Reset View
                </button>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1">
            {error ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-red-900/60 bg-red-950/20 px-4 text-center text-sm text-red-300">
                {error}
              </div>
            ) : graph ? (
              <div
                className="h-full w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_38%),linear-gradient(180deg,rgba(24,24,27,0.92),rgba(9,9,11,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
                  <rect x="0" y="0" width="100" height="100" rx="4" fill="transparent" />
                  <g stroke="rgba(63,63,70,0.6)" strokeWidth="0.35">
                    {graph.xTickPositions.map((position, index) => (
                      <line key={`x-grid-${graph.xTicks[index]}`} x1={position} y1="0" x2={position} y2="100" />
                    ))}
                    {graph.yTickPositions.map((position, index) => (
                      <line key={`y-grid-${graph.yTicks[index]}`} x1="0" y1={position} x2="100" y2={position} />
                    ))}
                  </g>
                  <line x1="0" y1={graph.xAxisY} x2="100" y2={graph.xAxisY} stroke="rgba(161,161,170,0.95)" strokeWidth="0.6" />
                  <line x1={graph.yAxisX} y1="0" x2={graph.yAxisX} y2="100" stroke="rgba(161,161,170,0.95)" strokeWidth="0.6" />
                  {graph.functions.map((graphFn) =>
                    graphFn.pathData.map((path, index) => (
                      <path
                        key={`${graphFn.id}-${index}`}
                        d={path}
                        fill="none"
                        stroke={graphFn.color}
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))
                  )}
                </svg>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/50 px-5 text-center">
                <p className="text-sm font-medium text-zinc-300">No graph yet</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
                  Use Graph Current, add a function, or tap a sample to start plotting.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">Functions</p>
            {hasFunctions && <span className="text-[10px] text-zinc-600">{functions.length}</span>}
          </div>
          <div className="space-y-2 overflow-y-auto max-h-full pr-1">
            {functions.length === 0 ? (
              <p className="text-xs text-zinc-500">Add a function or use Graph Current.</p>
            ) : (
              functions.map((graphFn, index) => (
                <button
                  key={graphFn.id}
                  onClick={() => onRemoveFunction(graphFn.id)}
                  className="flex w-full items-start gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/85 px-3 py-2.5 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-900"
                >
                  <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-zinc-950" style={{ backgroundColor: graphFn.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">{index + 1}</span>
                      <p className="truncate text-xs text-zinc-200">{graphFn.displayExpression}</p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">Remove</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
